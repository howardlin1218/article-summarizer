const now = new Date();
const n_year = now.getFullYear();
const n_month = now.getMonth() + 1;
const n_day = now.getDate();

// TypeScript interfaces for type safety
interface SearchValues {
    websites: string[];
    searchTerms: string;
    limit: number;
    day_from: number;
    month_from: number;
    year_from: number;
    day_to: number; 
    month_to: number; 
    year_to: number;
    keywords: string;
    customPrompt?: string;
}

interface SearchValuesDatabase {
    websites: string[];
    searchTerms: string;
    limit: number;
    day_from: number;
    month_from: number;
    year_from: number;
    day_to: number; 
    month_to: number; 
    year_to: number;
    keywords: string;
    urls: string;
}

interface ApiResponse {
    status: 'success' | 'error';
    message: string;
    html: string;
}

interface SearchMetadata {
    query: string;
    sites: string[];
    durationSec: number;
}

// Global declaration for DOMPurify loaded via CDN script
declare const DOMPurify: {
    sanitize(dirty: string, config?: any): string;
} | undefined;

function sanitizeHtml(dirty: string): string {
    if (typeof DOMPurify !== "undefined" && DOMPurify && typeof DOMPurify.sanitize === "function") {
        return DOMPurify.sanitize(dirty, {
            ADD_TAGS: ["input"],
            ADD_ATTR: ["target", "value", "name", "type", "checked", "style", "loading", "rel"],
        });
    }
    return dirty;
}

// API Configuration
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const API_BASE_URL = isLocal
      ? 'http://127.0.0.1:5000/api'
      : '/api';
      
async function makeApiRequest_recent(endpoint: string): Promise<ApiResponse> {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        return await response.json();
    } catch (error) {
        return {
            status: 'error',
            message: 'Network error or server unavailable',
            html: 'no body'
        };
    }
}

async function makeApiRequest_send(endpoint: string, data: string[], email_address: string): Promise<ApiResponse> {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({data, email_address}),
            credentials: 'include'
        });
        return await response.json();
    } catch (error) {
        return {
            status: 'error',
            message: 'Network error or server unavailable',
            html: 'no body'
        };
    }
}

// Function to make API requests
async function makeApiRequest_save(endpoint: string, data: string[]): Promise<ApiResponse> {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({data}),
            credentials: 'include'
        });
        return await response.json();
    } catch (error) {
        return {
            status: 'error',
            message: 'Network error or server unavailable',
            html: 'no body'
        };
    }
}

// Function to make API requests for site search with real-time SSE progress
async function makeApiRequest_stream(endpoint: string, data: SearchValues, onProgress: (event: any) => void): Promise<ApiResponse> {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        if (!response.ok) {
            const errJson = await response.json();
            return {
                status: 'error',
                message: errJson.detail || 'Request failed',
                html: ''
            };
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder('utf-8');
        let finalResponse: ApiResponse = { status: 'success', message: 'completed', html: '' };

        if (reader) {
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const eventData = JSON.parse(line.slice(6));
                            onProgress(eventData);
                            if (eventData.html !== undefined) {
                                finalResponse.html = eventData.html;
                                finalResponse.status = eventData.status || 'success';
                            }
                            if (eventData.status === 'error') {
                                finalResponse.status = 'error';
                                finalResponse.message = eventData.message || 'Server error';
                            }
                        } catch (e) {
                            console.error("Failed parsing SSE JSON chunk:", line);
                        }
                    }
                }
            }
        }
        return finalResponse;
    } catch (error) {
        return {
            status: 'error',
            message: 'Network error or server unavailable',
            html: ''
        };
    }
}

function showSearchProgress(): void {
    const submitBtn = document.getElementById('searchSubmitBtn');
    if (submitBtn) {
        submitBtn.classList.add('btn-hidden');
    }
    const container = document.getElementById('searchProgressContainer');
    if (!container) return;
    container.classList.remove('hidden');
    updateSearchProgress(1, 10, 'Initializing search request...');
    
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`step-${i}`);
        if (el) {
            el.className = 'progress-step';
        }
    }
}

function updateSearchProgress(stage: number, progressPct: number, message: string): void {
    const container = document.getElementById('searchProgressContainer');
    const bar = document.getElementById('progressBar');
    const msg = document.getElementById('progressMessage');
    const title = document.getElementById('progressTitle');
    
    if (container) container.classList.remove('hidden');
    if (bar) bar.style.width = `${progressPct}%`;
    if (msg) msg.textContent = message;
    
    if (title) {
        if (stage === 1) title.textContent = "Searching & Scraping Publications...";
        else if (stage === 2) title.textContent = "Validating Article Content...";
        else if (stage === 3) title.textContent = "AI Summarization & Sentiment Analysis...";
        else if (stage === 4) title.textContent = "Summarization Complete!";
    }

    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`step-${i}`);
        if (!el) continue;
        if (i < stage) {
            el.className = 'progress-step completed';
        } else if (i === stage) {
            el.className = 'progress-step active';
        } else {
            el.className = 'progress-step';
        }
    }
}

function hideSearchProgress(): void {
    const container = document.getElementById('searchProgressContainer');
    if (container) {
        container.classList.add('hidden');
    }
    const submitBtn = document.getElementById('searchSubmitBtn');
    if (submitBtn) {
        submitBtn.classList.remove('btn-hidden');
    }
}

// Function to make API requests for site search
async function makeApiRequestDatabase(endpoint: string, data: SearchValuesDatabase): Promise<ApiResponse> {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        return await response.json();
    } catch (error) {
        return {
            status: 'error',
            message: 'Network error or server unavailable',
            html: 'no body'
        };
    }
}

function scrollToArticlesCard(): void {
    const articlesCard = document.getElementById('articles-card');
    if (!articlesCard) return;
    const nav = document.querySelector('.app-nav') as HTMLElement | null;
    const navHeight = nav ? nav.getBoundingClientRect().height : 60;
    const cardTop = articlesCard.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({
        top: Math.max(0, cardTop - navHeight - 20),
        behavior: 'smooth'
    });
}

function getCheckedSiteLabels(inputName: string): string[] {
    const checkboxes = document.querySelectorAll(`input[name="${inputName}"]:checked`) as NodeListOf<HTMLInputElement>;
    const names: string[] = [];
    checkboxes.forEach(cb => {
        const label = document.querySelector(`label[for="${cb.id}"]`);
        const text = label?.textContent?.trim();
        if (text && text !== "Select All") {
            names.push(text);
        }
    });
    return names.length > 0 ? names : ["Selected Sources"];
}

function extractSitesFromElement(container: Element | DocumentFragment): string[] {
    const sites = new Set<string>();
    
    // Check modern preview card site badges
    container.querySelectorAll(".link-preview-site").forEach(el => {
        const text = el.textContent?.trim();
        if (text) sites.add(text);
    });

    // Fallback: Check metadata table rows for "Website"
    container.querySelectorAll("tr").forEach(row => {
        const thText = row.querySelector("th")?.textContent?.trim().toLowerCase();
        const tdText = row.querySelector("td")?.textContent?.trim();
        if (thText === "website" && tdText) {
            sites.add(tdText);
        }
    });

    return Array.from(sites);
}

function extractSitesFromArticlesHtml(html: string): string[] {
    const temp = document.createElement("div");
    temp.innerHTML = sanitizeHtml(html);
    return extractSitesFromElement(temp);
}

function extractSitesFromActivityLog(): string[] {
    const activityLog = document.getElementById('activity-log');
    if (!activityLog) return [];
    return extractSitesFromElement(activityLog);
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function createSearchMetadataBarHtml(metadata: SearchMetadata): string {
    const sites = metadata.sites && metadata.sites.length > 0 ? metadata.sites : ["Selected Sources"];
    const sitesHtml = sites
        .map(site => `<span class="metadata-badge">${escapeHtml(site)}</span>`)
        .join('');

    const durationText = metadata.durationSec && metadata.durationSec > 0
        ? `Completed in ${metadata.durationSec.toFixed(1)}s`
        : `Loaded from storage`;

    return `
        <div class="search-metadata-bar">
          <div class="metadata-bar-left">
            <div class="metadata-site-badges">
              ${sitesHtml}
            </div>
            <span class="metadata-query-term">Query: "${escapeHtml(metadata.query || 'Articles')}"</span>
          </div>
          <div class="metadata-bar-right">
            <span class="metadata-duration">${durationText}</span>
          </div>
        </div>
    `;
}

function syncSavedArticlesToLocalStorage(): void {
    const activityLog = document.getElementById("activity-log");
    if (!activityLog) return;
    const groups = activityLog.querySelectorAll(".search-output-group");
    const saved: string[] = [];
    groups.forEach(g => {
        saved.push(g.outerHTML);
    });
    if (groups.length === 0) {
        const loose = activityLog.querySelectorAll(".article-container");
        loose.forEach(a => saved.push(a.outerHTML));
    }
    if (saved.length > 0) {
        localStorage.setItem("savedArticles", JSON.stringify(saved));
    } else {
        localStorage.removeItem("savedArticles");
    }
}

// Function to display results in the activity log
function displayResults(response: ApiResponse, metadata?: SearchMetadata): void {
    const articlesCard = document.getElementById('articles-card');
    const article_search_result = document.getElementById('article-search-status');
    const activityLog = document.getElementById('activity-log');

    if (response.html === "" && article_search_result) {
        setTimeout(() => {
            scrollToArticlesCard();
        }, 100); // Small delay to ensure the content is rendered
        article_search_result.textContent = 'No Articles Found';
        return;
    }

    if (!activityLog || !articlesCard) return;
    
    // Show the articles card
    articlesCard.style.display = 'block';
    
    const isFirstResult = activityLog.querySelectorAll(".article-container").length === 0;
    if (isFirstResult) {
        const saveButtonTextContent = document.getElementById("saveArticlesBtn") as HTMLButtonElement;
        const emailButtonTextContent = document.getElementById("emailArticlesBtn") as HTMLButtonElement;
        const saveToFileBtn = document.getElementById("saveToFileBtn") as HTMLButtonElement;
        const clearArticlesBtn = document.getElementById('clearArticlesBtn') as HTMLButtonElement;

        if (saveButtonTextContent) saveButtonTextContent.style.display = "inline-block";
        if (emailButtonTextContent) emailButtonTextContent.style.display = "inline-block";
        if (saveToFileBtn) saveToFileBtn.style.display = "inline-block";
        if (clearArticlesBtn) clearArticlesBtn.style.display = "inline-block";
    }
    
    const sanitizedHtml = sanitizeHtml(response.html);
    const temp = document.createElement("div");
    temp.innerHTML = sanitizedHtml;

    const renderedArticles = temp.querySelectorAll(".article-container");
    if (renderedArticles.length === 0) return;

    let metaToUse = metadata;
    if (!metaToUse) {
        const sites = extractSitesFromArticlesHtml(sanitizedHtml);
        metaToUse = {
            query: "Saved Articles",
            sites: sites.length > 0 ? sites : ["Saved Sources"],
            durationSec: 0
        };
    }

    // Create a dedicated search output group enclosing this search's navbar and cards
    const searchGroup = document.createElement("div");
    searchGroup.className = "search-output-group";

    const navbarHtml = createSearchMetadataBarHtml(metaToUse);
    let articlesHtml = "";
    renderedArticles.forEach(el => {
        articlesHtml += el.outerHTML;
    });

    searchGroup.innerHTML = sanitizeHtml(navbarHtml + articlesHtml);
    activityLog.insertAdjacentElement('afterbegin', searchGroup);

    // Save all output groups to local storage
    syncSavedArticlesToLocalStorage();

    // Scroll to the Articles Found section with smooth animation
    setTimeout(() => {
        scrollToArticlesCard();
    }, 100); // Small delay to ensure the content is rendered
    if (article_search_result) {
        article_search_result.textContent = 'Articles Found';
    }
}

// function to display saved articles 
// Function to display results in the activity log
function displayResultsReload(): void {
    const stored = localStorage.getItem("savedArticles");
    if (!stored) return;

    let savedArticles: string[];
    try {
        savedArticles = JSON.parse(stored);
    } catch {
        return;
    }

    if (savedArticles.length === 0) return;

    const activityLog = document.getElementById('activity-log');
    const articlesCard = document.getElementById('articles-card');
    if (!activityLog || !articlesCard) return;
    
    // Show the articles card
    articlesCard.style.display = 'block';
    
    const saveButtonTextContent = document.getElementById("saveArticlesBtn") as HTMLButtonElement;
    const emailButtonTextContent = document.getElementById("emailArticlesBtn") as HTMLButtonElement;
    const saveToFileBtn = document.getElementById("saveToFileBtn") as HTMLButtonElement;
    const clearArticlesBtn = document.getElementById('clearArticlesBtn') as HTMLButtonElement;

    if (saveButtonTextContent) saveButtonTextContent.style.display = "inline-block";
    if (emailButtonTextContent) emailButtonTextContent.style.display = "inline-block";
    if (saveToFileBtn) saveToFileBtn.style.display = "inline-block";
    if (clearArticlesBtn) clearArticlesBtn.style.display = "inline-block";
    
    // Append each saved search-output-group (or wrap loose legacy articles)
    savedArticles.forEach(itemHTML => {
        const cleanItemHtml = sanitizeHtml(itemHTML.trim());
        const temp = document.createElement("div");
        temp.innerHTML = cleanItemHtml;
        
        const firstEl = temp.firstElementChild;
        if (firstEl?.classList.contains("search-output-group")) {
            activityLog.insertAdjacentHTML('beforeend', cleanItemHtml);
        } else if (temp.querySelector(".article-container")) {
            // Legacy loose article container: wrap in a search-output-group with its own navbar
            const sites = extractSitesFromArticlesHtml(cleanItemHtml);
            const navbarHtml = createSearchMetadataBarHtml({
                query: "Saved Articles",
                sites: sites.length > 0 ? sites : ["Saved Sources"],
                durationSec: 0
            });
            const groupHtml = `<div class="search-output-group">${navbarHtml}${cleanItemHtml}</div>`;
            activityLog.insertAdjacentHTML('beforeend', sanitizeHtml(groupHtml));
        } else {
            activityLog.insertAdjacentHTML('beforeend', cleanItemHtml);
        }
    });

    syncSavedArticlesToLocalStorage();

    // Scroll to the Articles Found section with smooth animation
    setTimeout(() => {
        scrollToArticlesCard();
    }, 100); // Small delay to ensure the content is rendered
}
// function to get unchecked articles
function getUncheckedArticles(): string[] {
    const allCheckboxes = document.querySelectorAll('input[name="articleCheckBox"]') as NodeListOf<HTMLInputElement>;
    const unchecked = Array.from(allCheckboxes).filter(checkbox => !checkbox.checked).map(checkbox => checkbox.value);
    
    return unchecked
}
// Function to get checked articles 
function getCheckedArticles(): string[] {
    const articleCheckboxes = document.querySelectorAll('input[name="articleCheckBox"]:checked') as NodeListOf<HTMLInputElement>;
    const articles = Array.from(articleCheckboxes).map(checkbox => checkbox.value);

    return articles
}

function clearCheckboxes(): void {
    const checkboxes = document.querySelectorAll<HTMLInputElement>('input[name="articleCheckBox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });

    const activityLog = document.getElementById("activity-log");
    if (activityLog?.children.length == 0) {
        const saveButtonTextContent = document.getElementById("saveArticlesBtn") as HTMLButtonElement;
        const emailButtonTextContent = document.getElementById("emailArticlesBtn") as HTMLButtonElement;
        const saveToFileBtn = document.getElementById("saveToFileBtn") as HTMLButtonElement;
        const clearArticlesBtn = document.getElementById('clearArticlesBtn') as HTMLButtonElement;

        saveButtonTextContent.style.display = "none";
        emailButtonTextContent.style.display = "none";
        saveToFileBtn.style.display = "none";
        clearArticlesBtn.style.display = "none";
    }
    return;
}

function clearArticles(): void {
    const container = document.getElementById("activity-log");
    if (!container) return;
    
    const sections = container.querySelectorAll(".article-container");
    sections.forEach(section => {
        const checkbox = section.querySelector('input[name="articleCheckBox"]') as HTMLInputElement | null;
        if (checkbox?.checked) {
            const group = section.closest('.search-output-group');
            section.remove();
            if (group && group.querySelectorAll('.article-container').length === 0) {
                group.remove();
            }
        }
    });
    
    syncSavedArticlesToLocalStorage();
}

// Function to get values from "Search a site" form
function getSiteSearchValues(): SearchValues {
    // Get all checked website checkboxes
    const websiteCheckboxes = document.querySelectorAll('input[name="websites"]:checked') as NodeListOf<HTMLInputElement>;
    const websites = Array.from(websiteCheckboxes).map(checkbox => checkbox.value);

    return {
        websites: websites || ["0"],
        searchTerms: (document.getElementById('search') as HTMLInputElement)?.value || "MSI",
        limit: Number((document.getElementById('amount') as HTMLInputElement)?.value) || 1,
        day_from: Number((document.getElementById('site-day-from') as HTMLInputElement)?.value) || 1,
        month_from: Number((document.getElementById('site-month-from') as HTMLInputElement)?.value) || 1,
        year_from: Number((document.getElementById('site-year-from') as HTMLInputElement)?.value) || n_year,
        day_to: Number((document.getElementById('site-day-to') as HTMLInputElement)?.value) || n_day,
        month_to: Number((document.getElementById('site-month-to') as HTMLInputElement)?.value) || n_month,
        year_to: Number((document.getElementById('site-year-to') as HTMLInputElement)?.value) || n_year,
        keywords: (document.getElementById('keywords') as HTMLInputElement)?.value || "",
        customPrompt: (document.getElementById('custom-prompt') as HTMLTextAreaElement)?.value || ""
    };
}

// Function to get values from "Search database" form
function getDatabaseSearchValues(): SearchValuesDatabase {
    // Get all checked website checkboxes from database form
    const websiteCheckboxes = document.querySelectorAll('input[name="database-websites"]:checked') as NodeListOf<HTMLInputElement>;
    const websites = Array.from(websiteCheckboxes).map(checkbox => {
        const label = document.querySelector(`label[for="${checkbox.id}"]`);
        return label?.textContent?.trim() ?? "";
    });

    return {
        websites: websites || ["Tom's Hardware"],
        searchTerms: (document.getElementById('database-search') as HTMLInputElement)?.value || "MSI",
        limit: Number((document.getElementById('database-amount') as HTMLInputElement)?.value) || 0,
        day_from: Number((document.getElementById('database-day-from') as HTMLInputElement)?.value) || 0,
        month_from: Number((document.getElementById('database-month-from') as HTMLInputElement)?.value) || 0,
        year_from: Number((document.getElementById('database-year-from') as HTMLInputElement)?.value) || 0,
        day_to: Number((document.getElementById('database-day-to') as HTMLInputElement)?.value) || 0,
        month_to: Number((document.getElementById('database-month-to') as HTMLInputElement)?.value) || 0,
        year_to: Number((document.getElementById('database-year-to') as HTMLInputElement)?.value) || 0,
        keywords: (document.getElementById('database-keywords') as HTMLInputElement)?.value || "",
        urls: (document.getElementById('database-urls') as HTMLInputElement)?.value || ""
    };
}


// function to send to email 
const modal = document.getElementById("emailModal") as HTMLDivElement;
const submitBtn = document.getElementById("submitBtn") as HTMLButtonElement;
const emailInput = document.getElementById("emailInput") as HTMLInputElement;

function showModal(): void {
    modal.classList.add("show");
    emailInput.value = "";
    submitBtn.disabled = true;
    emailInput.focus();
}

function hideModal(): void {
    modal.classList.remove("show");
}

function showErrorModal(message: string): void {
    const errorModal = document.getElementById("errorModal") as HTMLDivElement;
    const errorText = document.getElementById("errorMessageText") as HTMLParagraphElement;
    if (errorModal && errorText) {
        errorText.textContent = message;
        errorModal.classList.remove("hidden");
        errorModal.classList.add("show");
    }
}

function hideErrorModal(): void {
    const errorModal = document.getElementById("errorModal") as HTMLDivElement;
    if (errorModal) {
        errorModal.classList.remove("show");
        errorModal.classList.add("hidden");
    }
}

// DOM Content Loaded event handler
document.addEventListener('DOMContentLoaded', function(): void {
    displayResultsReload();

    // Generic helper to initialize single-select custom dropdowns
    function initSingleSelectDropdown(buttonId: string, contentId: string, textId: string, hiddenInputId: string): void {
        const button = document.getElementById(buttonId);
        const content = document.getElementById(contentId);
        const text = document.getElementById(textId);
        const hiddenInput = document.getElementById(hiddenInputId) as HTMLInputElement;
        const arrow = button?.querySelector('.dropdown-arrow');

        if (button && content && hiddenInput) {
            button.addEventListener('click', function(e: Event): void {
                e.preventDefault();
                e.stopPropagation();
                // Close other dropdowns first
                const allContents = document.querySelectorAll('.dropdown-content');
                allContents.forEach(c => {
                    if (c !== content) {
                        c.classList.remove('show');
                        c.parentElement?.querySelector('.dropdown-arrow')?.classList.remove('open');
                    }
                });
                
                content.classList.toggle('show');
                arrow?.classList.toggle('open');
            });

            content.querySelectorAll('.dropdown-option').forEach(option => {
                option.addEventListener('click', (e: Event): void => {
                    e.preventDefault();
                    e.stopPropagation();
                    const value = (option as HTMLElement).getAttribute('data-value') || '';
                    const label = (option as HTMLElement).textContent || '';
                    hiddenInput.value = value;
                    if (text) {
                        text.textContent = label;
                    }
                    content.classList.remove('show');
                    arrow?.classList.remove('open');
                    hiddenInput.dispatchEvent(new Event('change'));
                });
            });
        }
    }

    // Initialize custom single-select dropdowns for days, months, and years
    initSingleSelectDropdown('site-day-from-btn', 'site-day-from-content', 'site-day-from-text', 'site-day-from');
    initSingleSelectDropdown('site-month-from-btn', 'site-month-from-content', 'site-month-from-text', 'site-month-from');
    initSingleSelectDropdown('site-year-from-btn', 'site-year-from-content', 'site-year-from-text', 'site-year-from');

    initSingleSelectDropdown('site-day-to-btn', 'site-day-to-content', 'site-day-to-text', 'site-day-to');
    initSingleSelectDropdown('site-month-to-btn', 'site-month-to-content', 'site-month-to-text', 'site-month-to');
    initSingleSelectDropdown('site-year-to-btn', 'site-year-to-content', 'site-year-to-text', 'site-year-to');

    initSingleSelectDropdown('database-day-from-btn', 'database-day-from-content', 'database-day-from-text', 'database-day-from');
    initSingleSelectDropdown('database-month-from-btn', 'database-month-from-content', 'database-month-from-text', 'database-month-from');
    initSingleSelectDropdown('database-year-from-btn', 'database-year-from-content', 'database-year-from-text', 'database-year-from');

    initSingleSelectDropdown('database-day-to-btn', 'database-day-to-content', 'database-day-to-text', 'database-day-to');
    initSingleSelectDropdown('database-month-to-btn', 'database-month-to-content', 'database-month-to-text', 'database-month-to');
    initSingleSelectDropdown('database-year-to-btn', 'database-year-to-content', 'database-year-to-text', 'database-year-to');

    const btn = document.getElementById("backToTopBtn");
    if (btn) {
        // Show button when scrolling down past 300px
        window.addEventListener("scroll", () => {
            if (window.scrollY > 300) {
                btn.classList.add("visible");
            } else {
                btn.classList.remove("visible");
            }
        });

        // Scroll cleanly to the very top on click
        btn.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    // Wire up custom number input arrows
    function setupCustomNumberInput(inputId: string): void {
        const input = document.getElementById(inputId) as HTMLInputElement;
        if (!input) return;
        const container = input.closest('.number-input-container');
        if (!container) return;
        const upBtn = container.querySelector('.number-input-arrow.up');
        const downBtn = container.querySelector('.number-input-arrow.down');

        upBtn?.addEventListener('click', () => {
            const val = parseInt(input.value) || 0;
            const max = input.max ? parseInt(input.max) : 100;
            if (val < max) {
                input.value = (val + 1).toString();
                input.dispatchEvent(new Event('change'));
            }
        });

        downBtn?.addEventListener('click', () => {
            const val = parseInt(input.value) || 0;
            const min = input.min ? parseInt(input.min) : 0;
            if (val > min) {
                input.value = (val - 1).toString();
                input.dispatchEvent(new Event('change'));
            }
        });
    }

    setupCustomNumberInput('amount');
    setupCustomNumberInput('database-amount');

    // Dropdown functionality for site search
    const websiteDropdownButton = document.getElementById('websiteDropdownButton');
    const websiteDropdownContent = document.getElementById('websiteDropdownContent');
    const websiteDropdownText = document.getElementById('websiteDropdownText');
    const websiteDropdownArrow = websiteDropdownButton?.querySelector('.dropdown-arrow');

    if (websiteDropdownButton && websiteDropdownContent) {
        websiteDropdownButton.addEventListener('click', function(e: Event): void {
            e.preventDefault();
            e.stopPropagation();
            
            // Close other dropdowns first
            const allContents = document.querySelectorAll('.dropdown-content');
            allContents.forEach(c => {
                if (c !== websiteDropdownContent) {
                    c.classList.remove('show');
                    c.parentElement?.querySelector('.dropdown-arrow')?.classList.remove('open');
                }
            });

            websiteDropdownContent.classList.toggle('show');
            websiteDropdownArrow?.classList.toggle('open');
        });

        // Update dropdown text when selections change
        const updateWebsiteDropdownText = () => {
            const checkedBoxes = websiteDropdownContent.querySelectorAll('input[name="websites"]:checked');
            const count = checkedBoxes.length;
            if (websiteDropdownText) {
                if (count === 0) {
                    websiteDropdownText.textContent = 'Select websites...';
                } else if (count === 1) {
                    const label = checkedBoxes[0].parentElement?.querySelector('label')?.textContent || '';
                    websiteDropdownText.textContent = label;
                } else {
                    websiteDropdownText.textContent = `${count} websites selected`;
                }
            }
        };

        // Add change listeners to checkboxes
        websiteDropdownContent.querySelectorAll('input[name="websites"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateWebsiteDropdownText);
        });

        // Prevent dropdown from closing when clicking inside
        websiteDropdownContent.addEventListener('click', function(e: Event): void {
            e.stopPropagation();
        });
    }

    // update button text for save and clear when articles are selected 
    const clearButtonTextContent = document.getElementById("clearArticlesBtn") as HTMLButtonElement;
    const saveButtonTextContent = document.getElementById("saveArticlesBtn") as HTMLButtonElement;
    const emailButtonTextContent = document.getElementById("emailArticlesBtn") as HTMLButtonElement;
    const saveToFileBtn = document.getElementById("saveToFileBtn") as HTMLButtonElement;
    const clearSelectionsButton = document.getElementById('selectionsBtn') as HTMLButtonElement;
    
    if (clearSelectionsButton && clearButtonTextContent && saveButtonTextContent && emailButtonTextContent && saveToFileBtn) {
        const updateArticlesButton = () => {
            const count = getCheckedArticles().length;
            if (count == 0) {
                clearButtonTextContent.textContent = "Clear All";
                saveButtonTextContent.textContent = "Save All";
                emailButtonTextContent.textContent = "Email All";
                saveToFileBtn.textContent = "Save to File";
                clearSelectionsButton.style.display = "none";
            } else {
                clearButtonTextContent.textContent = `Clear ${count} Articles`;
                saveButtonTextContent.textContent = `Save ${count} Articles`;
                emailButtonTextContent.textContent = `Email ${count} Articles`;
                saveToFileBtn.textContent = `Save ${count} to File`;

                clearSelectionsButton.style.display = "inline-block";
                clearSelectionsButton.textContent  = `Clear ${count} Selections`;
            }
        };

        // Add change listeners to checkboxes
        document.addEventListener("change", (event => {
            const target = event.target as HTMLElement;
            if (target.matches('input[name="articleCheckBox"]')) {
                updateArticlesButton();
            }
        }));

        // clear selections functionality
        clearSelectionsButton.addEventListener('click', function(e: Event): void {
            clearCheckboxes();
            updateArticlesButton();
        });
    }

    // Dropdown functionality for database search
    const databaseWebsiteDropdownButton = document.getElementById('databaseWebsiteDropdownButton');
    const databaseWebsiteDropdownContent = document.getElementById('databaseWebsiteDropdownContent');
    const databaseWebsiteDropdownText = document.getElementById('databaseWebsiteDropdownText');
    const databaseWebsiteDropdownArrow = databaseWebsiteDropdownButton?.querySelector('.dropdown-arrow');

    if (databaseWebsiteDropdownButton && databaseWebsiteDropdownContent) {
        databaseWebsiteDropdownButton.addEventListener('click', function(e: Event): void {
            e.preventDefault();
            e.stopPropagation();
            
            // Close other dropdowns first
            const allContents = document.querySelectorAll('.dropdown-content');
            allContents.forEach(c => {
                if (c !== databaseWebsiteDropdownContent) {
                    c.classList.remove('show');
                    c.parentElement?.querySelector('.dropdown-arrow')?.classList.remove('open');
                }
            });

            databaseWebsiteDropdownContent.classList.toggle('show');
            databaseWebsiteDropdownArrow?.classList.toggle('open');
        });

        // Update dropdown text when selections change
        const updateDatabaseWebsiteDropdownText = () => {
            const checkedBoxes = databaseWebsiteDropdownContent.querySelectorAll('input[name="database-websites"]:checked');
            const count = checkedBoxes.length;
            if (databaseWebsiteDropdownText) {
                if (count === 0) {
                    databaseWebsiteDropdownText.textContent = 'Select websites...';
                } else if (count === 1) {
                    const label = checkedBoxes[0].parentElement?.querySelector('label')?.textContent || '';
                    databaseWebsiteDropdownText.textContent = label;
                } else {
                    databaseWebsiteDropdownText.textContent = `${count} websites selected`;
                }
            }
        };

        // Add change listeners to checkboxes
        databaseWebsiteDropdownContent.querySelectorAll('input[name="database-websites"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateDatabaseWebsiteDropdownText);
        });

        // Prevent dropdown from closing when clicking inside
        databaseWebsiteDropdownContent.addEventListener('click', function(e: Event): void {
            e.stopPropagation();
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event): void {
        const customDropdowns = document.querySelectorAll('.custom-dropdown');
        customDropdowns.forEach(dropdown => {
            const button = dropdown.querySelector('.dropdown-button');
            const content = dropdown.querySelector('.dropdown-content');
            const arrow = button?.querySelector('.dropdown-arrow');
            if (button && content && !button.contains(event.target as Node) && !content.contains(event.target as Node)) {
                content.classList.remove('show');
                arrow?.classList.remove('open');
            }
        });
    });

    // Select All functionality for site search
    const selectAllCheckbox = document.getElementById('selectAll') as HTMLInputElement;
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function(): void {
            const websiteCheckboxes = document.querySelectorAll('input[name="websites"]') as NodeListOf<HTMLInputElement>;
            websiteCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            // Update dropdown text
            if (websiteDropdownText) {
                const count = this.checked ? websiteCheckboxes.length : 0;
                if (count === 0) {
                    websiteDropdownText.textContent = 'Select websites...';
                } else {
                    websiteDropdownText.textContent = `${count} websites selected`;
                }
            }
        });
    }

    // Select All functionality for database search
    const databaseSelectAllCheckbox = document.getElementById('databaseSelectAll') as HTMLInputElement;
    if (databaseSelectAllCheckbox) {
        databaseSelectAllCheckbox.addEventListener('change', function(): void {
            const websiteCheckboxes = document.querySelectorAll('input[name="database-websites"]') as NodeListOf<HTMLInputElement>;
            websiteCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            // Update dropdown text
            if (databaseWebsiteDropdownText) {
                const count = this.checked ? websiteCheckboxes.length : 0;
                if (count === 0) {
                    databaseWebsiteDropdownText.textContent = 'Select websites...';
                } else {
                    databaseWebsiteDropdownText.textContent = `${count} websites selected`;
                }
            }
        });
    }

    // Clear Articles button functionality
    const clearArticlesBtn = document.getElementById('clearArticlesBtn') as HTMLButtonElement;
    if (clearArticlesBtn) {
        clearArticlesBtn.addEventListener('click', function(): void {
            const activityLog = document.getElementById('activity-log');
            const articlesCard = document.getElementById('articles-card');
            const articleCheckboxes: string[] = getCheckedArticles();
            
            if (activityLog && articlesCard) {
                if (articleCheckboxes.length == 0) {
                    activityLog.textContent = '';
                    localStorage.removeItem("savedArticles");
                    localStorage.removeItem("searchMetadata");
                    if (saveButtonTextContent) saveButtonTextContent.style.display = "none";
                    if (emailButtonTextContent) emailButtonTextContent.style.display = "none";
                    if (saveToFileBtn) saveToFileBtn.style.display = "none";
                    clearArticlesBtn.style.display = "none";
                } else {
                    clearArticles();
                    clearCheckboxes();
                    // Restore button state
                    clearButtonTextContent.textContent = "Clear All";
                    if (saveButtonTextContent) saveButtonTextContent.textContent = "Save All";
                    if (emailButtonTextContent) emailButtonTextContent.textContent = "Email All";
                    if (saveToFileBtn) saveToFileBtn.textContent = "Save to File";
                    if (clearSelectionsButton) clearSelectionsButton.style.display = "none";
                    if (activityLog.querySelectorAll(".article-container").length === 0) {
                        activityLog.textContent = '';
                        localStorage.removeItem("savedArticles");
                        localStorage.removeItem("searchMetadata");
                        if (saveButtonTextContent) saveButtonTextContent.style.display = "none";
                        if (emailButtonTextContent) emailButtonTextContent.style.display = "none";
                        if (saveToFileBtn) saveToFileBtn.style.display = "none";
                        clearArticlesBtn.style.display = "none";
                    }
                }
            }
        });
    }


    // email articles functionality 
    
    const modal = document.getElementById("emailModal") as HTMLDivElement;
    const cancelBtn = document.getElementById("cancelBtn") as HTMLButtonElement;
    const submitBtn = document.getElementById("submitBtn") as HTMLButtonElement;
    const emailInput = document.getElementById("emailInput") as HTMLInputElement;
    const emailArticlesBtn = document.getElementById('emailArticlesBtn') as HTMLButtonElement;
    

    if (emailArticlesBtn) {
        emailArticlesBtn.addEventListener("click", showModal);
        cancelBtn.addEventListener("click", hideModal);

        // Enable submit only if email is valid
        emailInput.addEventListener("input", () => {
            const email = emailInput.value;
            const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            submitBtn.disabled = !isValid;
        });

        submitBtn.addEventListener("click", async function(e: Event): Promise<void> {
            hideModal();
            if (submitBtn.disabled === true) {
                return;
            }
            let articleCheckboxes: string[] = getCheckedArticles();
            e.preventDefault();
            
            // send all articles
            if (articleCheckboxes.length == 0) {
                articleCheckboxes = getUncheckedArticles();
                if (articleCheckboxes.length == 0) {
                    alert("nothing to save");
                    return;
                }
            } 

            const originalText = emailArticlesBtn.textContent;
            emailArticlesBtn.textContent = 'Sending...';
            emailArticlesBtn.disabled = true;

            try {
                const response = await makeApiRequest_send('/email-to-user', articleCheckboxes, emailInput.value);
                if (response.status === 'success') {
                    alert("Sucessfully sent");
                } else {
                    alert(`Error: ${response.message}`);
                }
            } catch (error) {
                alert('Save failed. Please try again.');
            } finally {
            // Restore button state
                emailArticlesBtn.textContent = originalText;
                emailArticlesBtn.disabled = false;
            }
        });
        // Close modal by clicking outside modal-content
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });
        
        const errorCloseBtn = document.getElementById("errorCloseBtn") as HTMLButtonElement;
        if (errorCloseBtn) {
            errorCloseBtn.addEventListener("click", hideErrorModal);
        }
        
        const errorModal = document.getElementById("errorModal") as HTMLDivElement;
        if (errorModal) {
            errorModal.addEventListener("click", (e) => {
                if (e.target === errorModal) {
                    hideErrorModal();
                }
            });
        }
    }

    // Save Articles button functionality
    const saveArticlesBtn = document.getElementById('saveArticlesBtn') as HTMLButtonElement;
    
    if (saveArticlesBtn) {
        saveArticlesBtn.addEventListener('click', async function(e: Event): Promise<void> {
            let articleCheckboxes: string[] = getCheckedArticles();
            e.preventDefault();
            
            // save all articles
            if (articleCheckboxes.length == 0) {
                articleCheckboxes = getUncheckedArticles();
                if (articleCheckboxes.length == 0) {
                    alert("nothing to save");
                    return;
                }
            } 
            const originalText = saveArticlesBtn.textContent;
            saveArticlesBtn.textContent = 'Saving...';
            saveArticlesBtn.disabled = true;

            try {
                const response = await makeApiRequest_save('/save-to-database', articleCheckboxes);
                if (response.status === 'success') {
                    alert("Sucessfully saved");
                    //clearCheckboxes();
                } else {
                    alert(`Error: ${response.message}`);
                }
            } catch (error) {
                alert('Save failed. Please try again.');
            } finally {
            // Restore button state
                saveArticlesBtn.textContent = originalText;
                saveArticlesBtn.disabled = false;
            }

            }); 
    }

    const saveToFileBtnElement = document.getElementById('saveToFileBtn') as HTMLButtonElement;
    if (saveToFileBtnElement) {
        saveToFileBtnElement.addEventListener("click", function(e: Event): void {
            e.preventDefault();
            
            const activityLog = document.getElementById('activity-log');
            if (!activityLog) return;

            const checkedArticles = getCheckedArticles();
            let selectedContainers: Element[] = [];

            if (checkedArticles.length > 0) {
                checkedArticles.forEach(url => {
                    const cb = document.querySelector(`input[name="articleCheckBox"][value="${url}"]`);
                    const container = cb?.closest('.article-container');
                    if (container) {
                        selectedContainers.push(container);
                    }
                });
            } else {
                // If none checked, download all articles shown
                const allContainers = activityLog.querySelectorAll('.article-container');
                allContainers.forEach(container => {
                    selectedContainers.push(container);
                });
            }

            if (selectedContainers.length === 0) {
                alert("nothing to save");
                return;
            }

            // Combine HTML and clean up checkboxes & legacy inline styles
            let htmlContent = "";
            selectedContainers.forEach(container => {
                const clone = container.cloneNode(true) as HTMLElement;
                const checkbox = clone.querySelector('input[name="articleCheckBox"]');
                if (checkbox) {
                    checkbox.remove();
                }

                // Strip legacy inline style on the container so dark card styles apply cleanly
                clone.removeAttribute('style');

                // Sanitize any inline background and border styles inside the card
                clone.querySelectorAll<HTMLElement>('*').forEach(el => {
                    const inlineBg = el.style.backgroundColor;
                    if (inlineBg && (
                        inlineBg === 'rgb(249, 249, 249)' ||
                        inlineBg === '#f9f9f9' ||
                        inlineBg === 'rgb(255, 255, 255)' ||
                        inlineBg === '#fff' ||
                        inlineBg === '#ffffff' ||
                        inlineBg === 'white'
                    )) {
                        el.style.backgroundColor = '';
                    }

                    const inlineBorder = el.style.borderColor;
                    if (inlineBorder && (
                        inlineBorder === 'rgb(221, 221, 221)' ||
                        inlineBorder === '#ddd' ||
                        inlineBorder === 'rgb(204, 204, 204)' ||
                        inlineBorder === '#ccc'
                    )) {
                        el.style.borderColor = '';
                    }

                    if (el.classList.contains('article-analysis')) {
                        el.style.backgroundColor = 'transparent';
                        el.style.padding = '0';
                    }
                });

                htmlContent += clone.outerHTML + "\n";
            });

            // Wrap in standard HTML template for saving
            const fullHtml = `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Saved Summaries</title>
                    <style>
                        * {
                            box-sizing: border-box;
                        }

                        body {
                            background-color: #09090b !important;
                            color: #f4f4f5 !important;
                            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                            padding: 2rem;
                            max-width: 860px;
                            margin: 0 auto;
                            line-height: 1.5;
                        }

                        .article-container {
                            margin-bottom: 2rem !important;
                            padding: 1.75rem !important;
                            border: 1px solid #27272a !important;
                            border-radius: 8px !important;
                            background-color: #18181b !important;
                            color: #f4f4f5 !important;
                            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
                            position: relative !important;
                        }

                        .article-analysis {
                            font-family: inherit !important;
                            padding: 0 !important;
                            background-color: transparent !important;
                            background: transparent !important;
                            display: flex !important;
                            flex-direction: column !important;
                            gap: 1.5rem !important;
                        }

                        .article-analysis h2 {
                            font-size: 1.25rem !important;
                            font-weight: 600 !important;
                            color: #f4f4f5 !important;
                            margin-top: 1.5rem !important;
                            margin-bottom: 0.75rem !important;
                        }

                        /* Table styles inside saved file */
                        table {
                            width: 100% !important;
                            border-collapse: collapse !important;
                            margin-bottom: 1.5rem !important;
                            background-color: #09090b !important;
                            border: 1px solid #27272a !important;
                            border-radius: 6px !important;
                            overflow: hidden !important;
                        }

                        th, td {
                            border: 1px solid #27272a !important;
                            padding: 0.75rem 1rem !important;
                            font-size: 0.85rem !important;
                            text-align: left !important;
                        }

                        th {
                            background-color: rgba(255, 255, 255, 0.02) !important;
                            color: #a1a1aa !important;
                            font-weight: 600 !important;
                            width: 140px !important;
                        }

                        td {
                            color: #f4f4f5 !important;
                        }

                        td a {
                            color: #f4f4f5 !important;
                            text-decoration: underline !important;
                        }

                        /* Link Preview Card */
                        .link-preview-card {
                            display: flex !important;
                            gap: 1.25rem !important;
                            background-color: #09090b !important;
                            border: 1px solid #27272a !important;
                            border-radius: 6px !important;
                            padding: 1.25rem !important;
                            margin-top: 0.5rem !important;
                            overflow: hidden !important;
                            align-items: stretch !important;
                            text-align: left !important;
                        }

                        .link-preview-details {
                            flex: 1 !important;
                            display: flex !important;
                            flex-direction: column !important;
                            gap: 0.5rem !important;
                            justify-content: center !important;
                        }

                        .link-preview-site {
                            font-size: 0.75rem !important;
                            text-transform: uppercase !important;
                            letter-spacing: 0.05em !important;
                            color: #a1a1aa !important;
                            font-weight: 600 !important;
                        }

                        .link-preview-title {
                            font-size: 1.05rem !important;
                            font-weight: 600 !important;
                            color: #f4f4f5 !important;
                            text-decoration: underline !important;
                            line-height: 1.4 !important;
                        }

                        .link-preview-desc {
                            font-size: 0.85rem !important;
                            color: #a1a1aa !important;
                            line-height: 1.5 !important;
                            margin: 0 !important;
                        }

                        .link-preview-meta {
                            display: flex !important;
                            align-items: center !important;
                            gap: 0.5rem !important;
                            font-size: 0.75rem !important;
                            color: #a1a1aa !important;
                            margin-top: 0.25rem !important;
                        }

                        .link-preview-divider {
                            color: #3f3f46 !important;
                        }

                        .link-preview-thumbnail {
                            width: 120px !important;
                            min-width: 120px !important;
                            height: 90px !important;
                            border-radius: 4px !important;
                            overflow: hidden !important;
                            border: 1px solid #27272a !important;
                            align-self: center !important;
                            display: flex !important;
                        }

                        .link-preview-thumbnail img {
                            width: 100% !important;
                            height: 100% !important;
                            object-fit: cover !important;
                        }

                        /* Summary Box */
                        ul.summary-box,
                        .summary-box,
                        .article-analysis > ul:not(.sentiment-block ul) {
                            background-color: #09090b !important;
                            padding: 1.25rem 1.5rem 1.25rem 2rem !important;
                            border: 1px solid #27272a !important;
                            border-radius: 6px !important;
                            margin-bottom: 1.5rem !important;
                            color: #f4f4f5 !important;
                        }

                        li {
                            margin-bottom: 0.5rem !important;
                            font-size: 0.9rem !important;
                            line-height: 1.5 !important;
                            color: #e4e4e7 !important;
                        }

                        /* Sentiment section inside saved file */
                        .sentiment-section {
                            display: grid !important;
                            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) !important;
                            gap: 1rem !important;
                            margin-top: 0.5rem !important;
                        }

                        .sentiment-block {
                            padding: 1.25rem !important;
                            border-radius: 6px !important;
                            border: 1px solid #27272a !important;
                            background-color: #09090b !important;
                            color: #f4f4f5 !important;
                        }

                        .sentiment-block.positive {
                            border-left: 4px solid #22c55e !important;
                        }

                        .sentiment-block.neutral {
                            border-left: 4px solid #ef4444 !important;
                        }

                        .sentiment-block.negative {
                            border-left: 4px solid #71717a !important;
                        }

                        .sentiment-block h3 {
                            font-size: 0.95rem !important;
                            font-weight: 600 !important;
                            color: #f4f4f5 !important;
                            margin-top: 0 !important;
                            margin-bottom: 0.75rem !important;
                        }

                        .sentiment-block ul {
                            background-color: transparent !important;
                            background: transparent !important;
                            border: none !important;
                            padding: 0 0 0 1.25rem !important;
                            margin: 0 !important;
                        }

                        .sentiment-block li {
                            color: #a1a1aa !important;
                            font-size: 0.85rem !important;
                            margin-bottom: 0.5rem !important;
                        }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                </body>
                </html>`;

            // Create Blob and trigger local download
            const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'summaries.html';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }); 
    }

    // Form submission handler for site search
    const quickActionsForm = document.getElementById('quickActionsForm') as HTMLFormElement;
    if (quickActionsForm) {
        quickActionsForm.addEventListener('submit', async function(e: Event): Promise<void> {
            e.preventDefault();
            const values: SearchValues = getSiteSearchValues();
            
            // Validation
            if (!values.searchTerms.trim()) {
                alert('Please enter search terms');
                return;
            }

            if (values.websites.length === 0) {
                alert('Please select at least one website');
                return;
            }

            // Show loading state
            const submitButton = quickActionsForm.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Searching...';
            submitButton.disabled = true;

            const startTime = performance.now();
            const selectedSites = getCheckedSiteLabels('websites');
            const searchTerms = values.searchTerms.trim() || values.keywords.trim() || 'Tech Articles';

            try {
                showSearchProgress();
                // Make streaming API request to backend
                const response = await makeApiRequest_stream('/search-site-stream', values, (eventData) => {
                    updateSearchProgress(eventData.stage, eventData.progress, eventData.message);
                });

                if (response.status === 'success') {
                    const durationSec = (performance.now() - startTime) / 1000;
                    displayResults(response, {
                        query: searchTerms,
                        sites: selectedSites,
                        durationSec: durationSec
                    });
                } else {
                    showErrorModal(response.message || "An unknown error occurred.");
                }
            } catch (error) {
                alert('Search failed. Please try again.');
            } finally {
                setTimeout(() => {
                    hideSearchProgress();
                }, 1200);
                // Restore button state
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
    
    const recentBtn = document.getElementById('recent-ten') as HTMLButtonElement; 
    if (recentBtn) {
        recentBtn.addEventListener('click', async function(e: Event): Promise<void> {
            e.preventDefault();

            const originalText = recentBtn.textContent;
            recentBtn.textContent = 'Requesting...';
            recentBtn.disabled = true;

            const startTime = performance.now();
            try {
                const response = await makeApiRequest_recent('/recent-saves');
                if (response.status === 'success') {
                    const durationSec = (performance.now() - startTime) / 1000;
                    const sites = extractSitesFromArticlesHtml(response.html);
                    displayResults(response, {
                        query: "Recently Saved",
                        sites: sites.length > 0 ? sites : ["Supabase Archive"],
                        durationSec: durationSec
                    });
                } else {
                    alert(`Error: ${response.message}`);
                }
            } catch (error) {
                alert('Save failed. Please try again.');
            } finally {
            // Restore button state
                recentBtn.textContent = originalText;
                recentBtn.disabled = false;
            }
        });
    }

    const allSavedBtn = document.getElementById('saved-all') as HTMLButtonElement; 
    if (allSavedBtn) {
        allSavedBtn.addEventListener('click', async function(e: Event): Promise<void> {
            e.preventDefault();

            const originalText = allSavedBtn.textContent;
            allSavedBtn.textContent = 'Requesting...';
            allSavedBtn.disabled = true;

            const startTime = performance.now();
            try {
                const response = await makeApiRequest_recent('/all-saved');
                if (response.status === 'success') {
                    const durationSec = (performance.now() - startTime) / 1000;
                    const sites = extractSitesFromArticlesHtml(response.html);
                    displayResults(response, {
                        query: "All Saved Articles",
                        sites: sites.length > 0 ? sites : ["Supabase Archive"],
                        durationSec: durationSec
                    });
                } else {
                    alert(`Error: ${response.message}`);
                }
            } catch (error) {
                alert('Save failed. Please try again.');
            } finally {
            // Restore button state
                allSavedBtn.textContent = originalText;
                allSavedBtn.disabled = false;
            }
        });
    }

    // Form submission handler for database search
    const databaseSearchForm = document.getElementById('databaseSearchForm') as HTMLFormElement;
    if (databaseSearchForm) {
        databaseSearchForm.addEventListener('submit', async function(e: Event): Promise<void> {
            e.preventDefault();
            const values: SearchValuesDatabase = getDatabaseSearchValues();

            if (values.websites.length === 0) {
                alert('Please select at least one website');
                return;
            }

            // Show loading state
            const submitButton = databaseSearchForm.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Searching...';
            submitButton.disabled = true;

            const startTime = performance.now();
            const selectedSites = getCheckedSiteLabels('database-websites');
            const searchTerms = values.searchTerms.trim() || values.keywords.trim() || 'All Database Articles';

            try {
                // Make API request to backend
                const response = await makeApiRequestDatabase('/search-database', values);
                if (response.status === 'success') {
                    const durationSec = (performance.now() - startTime) / 1000;
                    displayResults(response, {
                        query: searchTerms,
                        sites: selectedSites,
                        durationSec: durationSec
                    });
                } else {
                    alert(`Error: ${response.message}`);
                }
            } catch (error) {
                //console.error('Database search failed:', error);
                alert('Database search failed. Please try again.');
            } finally {
                // Restore button state
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }

    // Workspace tab switcher (Live Scraper vs Supabase Database Archive)
    const tabLiveScraper = document.getElementById('tabLiveScraper') as HTMLButtonElement | null;
    const tabDatabaseArchive = document.getElementById('tabDatabaseArchive') as HTMLButtonElement | null;
    const scraperCard = document.getElementById('scraper-card') as HTMLElement | null;
    const databaseCard = document.getElementById('database-card') as HTMLElement | null;

    if (tabLiveScraper && tabDatabaseArchive && scraperCard && databaseCard) {
        tabLiveScraper.addEventListener('click', () => {
            tabLiveScraper.classList.add('active');
            tabDatabaseArchive.classList.remove('active');
            scraperCard.style.display = 'flex';
            databaseCard.style.display = 'none';
        });

        tabDatabaseArchive.addEventListener('click', () => {
            tabDatabaseArchive.classList.add('active');
            tabLiveScraper.classList.remove('active');
            scraperCard.style.display = 'none';
            databaseCard.style.display = 'flex';
        });
    }
});
