"use strict";
const now = new Date();
const n_year = now.getFullYear();
const n_month = now.getMonth() + 1;
const n_day = now.getDate();
// API Configuration
// const API_BASE_URL = 'https://www.summarizer.howard1218.site/api';
const API_BASE_URL = 'http://127.0.0.1:5000/api';
async function makeApiRequest_recent(endpoint) {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(url);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        return await response.json();
    }
    catch (error) {
        return {
            status: 'error',
            message: 'Network error or server unavailable',
            html: 'no body'
        };
    }
}
async function makeApiRequest_send(endpoint, data, email_address) {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data, email_address }),
            credentials: 'include'
        });
        return await response.json();
    }
    catch (error) {
        return {
            status: 'error',
            message: 'Network error or server unavailable',
            html: 'no body'
        };
    }
}
// Function to make API requests
async function makeApiRequest_save(endpoint, data) {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data }),
            credentials: 'include'
        });
        return await response.json();
    }
    catch (error) {
        return {
            status: 'error',
            message: 'Network error or server unavailable',
            html: 'no body'
        };
    }
}
// Function to make API requests for site search with real-time SSE progress
async function makeApiRequest_stream(endpoint, data, onProgress) {
    var _a;
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
        const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
        const decoder = new TextDecoder('utf-8');
        let finalResponse = { status: 'success', message: 'completed', html: '' };
        if (reader) {
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
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
                        }
                        catch (e) {
                            console.error("Failed parsing SSE JSON chunk:", line);
                        }
                    }
                }
            }
        }
        return finalResponse;
    }
    catch (error) {
        return {
            status: 'error',
            message: 'Network error or server unavailable',
            html: ''
        };
    }
}
function showSearchProgress() {
    const submitBtn = document.getElementById('searchSubmitBtn');
    if (submitBtn) {
        submitBtn.classList.add('btn-hidden');
    }
    const container = document.getElementById('searchProgressContainer');
    if (!container)
        return;
    container.classList.remove('hidden');
    updateSearchProgress(1, 10, 'Initializing search request...');
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`step-${i}`);
        if (el) {
            el.className = 'progress-step';
        }
    }
}
function updateSearchProgress(stage, progressPct, message) {
    const container = document.getElementById('searchProgressContainer');
    const bar = document.getElementById('progressBar');
    const msg = document.getElementById('progressMessage');
    const title = document.getElementById('progressTitle');
    if (container)
        container.classList.remove('hidden');
    if (bar)
        bar.style.width = `${progressPct}%`;
    if (msg)
        msg.textContent = message;
    if (title) {
        if (stage === 1)
            title.textContent = "Searching Target Publications...";
        else if (stage === 2)
            title.textContent = "Scraping & Extracting Articles...";
        else if (stage === 3)
            title.textContent = "AI Summarization & Sentiment Analysis...";
        else if (stage === 4)
            title.textContent = "Summarization Complete!";
    }
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`step-${i}`);
        if (!el)
            continue;
        if (i < stage) {
            el.className = 'progress-step completed';
        }
        else if (i === stage) {
            el.className = 'progress-step active';
        }
        else {
            el.className = 'progress-step';
        }
    }
}
function hideSearchProgress() {
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
async function makeApiRequestDatabase(endpoint, data) {
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
    }
    catch (error) {
        return {
            status: 'error',
            message: 'Network error or server unavailable',
            html: 'no body'
        };
    }
}
// Function to display results in the activity log
function displayResults(response) {
    const articlesCard = document.getElementById('articles-card');
    const article_search_result = document.getElementById('article-search-status');
    if (response.html === "" && article_search_result) {
        setTimeout(() => {
            articlesCard === null || articlesCard === void 0 ? void 0 : articlesCard.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 100); // Small delay to ensure the content is rendered
        article_search_result.textContent = 'No Articles Found';
        return;
    }
    saveToLocalStorage(response.html);
    const stored = localStorage.getItem("savedArticles");
    if (!stored)
        return;
    const activityLog = document.getElementById('activity-log');
    if (!activityLog || !articlesCard)
        return;
    // Show the articles card
    articlesCard.style.display = 'block';
    const isFirstResult = activityLog.children.length === 0;
    if (isFirstResult) {
        const saveButtonTextContent = document.getElementById("saveArticlesBtn");
        const emailButtonTextContent = document.getElementById("emailArticlesBtn");
        const saveToFileBtn = document.getElementById("saveToFileBtn");
        const clearArticlesBtn = document.getElementById('clearArticlesBtn');
        saveButtonTextContent.style.display = "inline-block";
        emailButtonTextContent.style.display = "inline-block";
        saveToFileBtn.style.display = "inline-block";
        clearArticlesBtn.style.display = "inline-block";
    }
    const temp = document.createElement("div");
    temp.innerHTML = response.html;
    temp.querySelectorAll(".article-container").forEach(el => {
        activityLog.insertAdjacentHTML('afterbegin', el.outerHTML);
    });
    // Scroll to the Articles Found section with smooth animation
    setTimeout(() => {
        articlesCard.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }, 100); // Small delay to ensure the content is rendered
    if (article_search_result) {
        article_search_result.textContent = 'Articles Found';
    }
}
// function to display saved articles 
// Function to display results in the activity log
function displayResultsReload() {
    const stored = localStorage.getItem("savedArticles");
    if (!stored)
        return;
    let savedArticles;
    try {
        savedArticles = JSON.parse(stored);
    }
    catch (_a) {
        return;
    }
    const activityLog = document.getElementById('activity-log');
    const articlesCard = document.getElementById('articles-card');
    if (!activityLog || !articlesCard)
        return;
    // Show the articles card
    articlesCard.style.display = 'block';
    // Check if this is the first result - if so, clear the default "No articles found" message
    const isFirstResult = activityLog.children.length === 0;
    if (isFirstResult) {
        const saveButtonTextContent = document.getElementById("saveArticlesBtn");
        const emailButtonTextContent = document.getElementById("emailArticlesBtn");
        const saveToFileBtn = document.getElementById("saveToFileBtn");
        const clearArticlesBtn = document.getElementById('clearArticlesBtn');
        saveButtonTextContent.style.display = "inline-block";
        emailButtonTextContent.style.display = "inline-block";
        saveToFileBtn.style.display = "inline-block";
        clearArticlesBtn.style.display = "inline-block";
    }
    // Append new result (don't clear existing content)
    savedArticles.forEach(articleHTML => {
        activityLog.insertAdjacentHTML('beforeend', articleHTML);
    });
    // Scroll to the Articles Found section with smooth animation
    setTimeout(() => {
        articlesCard.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }, 100); // Small delay to ensure the content is rendered
}
// function to get unchecked articles
function getUncheckedArticles() {
    const allCheckboxes = document.querySelectorAll('input[name="articleCheckBox"]');
    const unchecked = Array.from(allCheckboxes).filter(checkbox => !checkbox.checked).map(checkbox => checkbox.value);
    return unchecked;
}
// Function to get checked articles 
function getCheckedArticles() {
    const articleCheckboxes = document.querySelectorAll('input[name="articleCheckBox"]:checked');
    const articles = Array.from(articleCheckboxes).map(checkbox => checkbox.value);
    return articles;
}
function clearCheckboxes() {
    const checkboxes = document.querySelectorAll('input[name="articleCheckBox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    const activityLog = document.getElementById("activity-log");
    if ((activityLog === null || activityLog === void 0 ? void 0 : activityLog.children.length) == 0) {
        const saveButtonTextContent = document.getElementById("saveArticlesBtn");
        const emailButtonTextContent = document.getElementById("emailArticlesBtn");
        const saveToFileBtn = document.getElementById("saveToFileBtn");
        const clearArticlesBtn = document.getElementById('clearArticlesBtn');
        saveButtonTextContent.style.display = "none";
        emailButtonTextContent.style.display = "none";
        saveToFileBtn.style.display = "none";
        clearArticlesBtn.style.display = "none";
    }
    return;
}
function clearArticles() {
    const container = document.getElementById("activity-log");
    const stored = localStorage.getItem("savedArticles");
    if (!container)
        return;
    let savedArticles = [];
    if (stored) {
        savedArticles = JSON.parse(stored);
    }
    const sections = container.querySelectorAll(".article-container");
    let updatedArticles = [];
    let currentArticleIndex = 0;
    sections.forEach(section => {
        const checkbox = section.querySelector('input[name="articleCheckBox"]');
        if (checkbox === null || checkbox === void 0 ? void 0 : checkbox.checked) {
            section.remove();
            // savedArticles = savedArticles.filter(html => !html.includes(section.outerHTML));
        }
        else {
            updatedArticles.push(savedArticles[currentArticleIndex]);
        }
        currentArticleIndex++;
    });
    localStorage.setItem("savedArticles", JSON.stringify(updatedArticles));
    return;
}
// Function to get values from "Search a site" form
function getSiteSearchValues() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    // Get all checked website checkboxes
    const websiteCheckboxes = document.querySelectorAll('input[name="websites"]:checked');
    const websites = Array.from(websiteCheckboxes).map(checkbox => checkbox.value);
    return {
        websites: websites || ["0"],
        searchTerms: ((_a = document.getElementById('search')) === null || _a === void 0 ? void 0 : _a.value) || "MSI",
        limit: Number((_b = document.getElementById('amount')) === null || _b === void 0 ? void 0 : _b.value) || 1,
        day_from: Number((_c = document.getElementById('site-day-from')) === null || _c === void 0 ? void 0 : _c.value) || 1,
        month_from: Number((_d = document.getElementById('site-month-from')) === null || _d === void 0 ? void 0 : _d.value) || 1,
        year_from: Number((_e = document.getElementById('site-year-from')) === null || _e === void 0 ? void 0 : _e.value) || n_year,
        day_to: Number((_f = document.getElementById('site-day-to')) === null || _f === void 0 ? void 0 : _f.value) || n_day,
        month_to: Number((_g = document.getElementById('site-month-to')) === null || _g === void 0 ? void 0 : _g.value) || n_month,
        year_to: Number((_h = document.getElementById('site-year-to')) === null || _h === void 0 ? void 0 : _h.value) || n_year,
        keywords: ((_j = document.getElementById('keywords')) === null || _j === void 0 ? void 0 : _j.value) || "",
        customPrompt: ((_k = document.getElementById('custom-prompt')) === null || _k === void 0 ? void 0 : _k.value) || ""
    };
}
// Function to get values from "Search database" form
function getDatabaseSearchValues() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    // Get all checked website checkboxes from database form
    const websiteCheckboxes = document.querySelectorAll('input[name="database-websites"]:checked');
    const websites = Array.from(websiteCheckboxes).map(checkbox => {
        var _a, _b;
        const label = document.querySelector(`label[for="${checkbox.id}"]`);
        return (_b = (_a = label === null || label === void 0 ? void 0 : label.textContent) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : "";
    });
    return {
        websites: websites || ["Tom's Hardware"],
        searchTerms: ((_a = document.getElementById('database-search')) === null || _a === void 0 ? void 0 : _a.value) || "MSI",
        limit: Number((_b = document.getElementById('database-amount')) === null || _b === void 0 ? void 0 : _b.value) || 0,
        day_from: Number((_c = document.getElementById('database-day-from')) === null || _c === void 0 ? void 0 : _c.value) || 0,
        month_from: Number((_d = document.getElementById('database-month-from')) === null || _d === void 0 ? void 0 : _d.value) || 0,
        year_from: Number((_e = document.getElementById('database-year-from')) === null || _e === void 0 ? void 0 : _e.value) || 0,
        day_to: Number((_f = document.getElementById('database-day-to')) === null || _f === void 0 ? void 0 : _f.value) || 0,
        month_to: Number((_g = document.getElementById('database-month-to')) === null || _g === void 0 ? void 0 : _g.value) || 0,
        year_to: Number((_h = document.getElementById('database-year-to')) === null || _h === void 0 ? void 0 : _h.value) || 0,
        keywords: ((_j = document.getElementById('database-keywords')) === null || _j === void 0 ? void 0 : _j.value) || "",
        urls: ((_k = document.getElementById('database-urls')) === null || _k === void 0 ? void 0 : _k.value) || ""
    };
}
// function to send to email 
const modal = document.getElementById("emailModal");
const submitBtn = document.getElementById("submitBtn");
const emailInput = document.getElementById("emailInput");
function showModal() {
    modal.classList.add("show");
    emailInput.value = "";
    submitBtn.disabled = true;
    emailInput.focus();
}
function hideModal() {
    modal.classList.remove("show");
}
// save to local storage 
function saveToLocalStorage(newHMTL) {
    const temp = document.createElement("div");
    temp.innerHTML = newHMTL;
    const newArticles = [];
    temp.querySelectorAll(".article-container").forEach(el => {
        newArticles.unshift(el.outerHTML);
    });
    const stored = localStorage.getItem("savedArticles");
    let savedArticles = [];
    if (stored) {
        savedArticles = JSON.parse(stored);
    }
    // append saved articles to new articles 
    newArticles.push(...savedArticles);
    localStorage.setItem("savedArticles", JSON.stringify(newArticles));
}
// DOM Content Loaded event handler
document.addEventListener('DOMContentLoaded', function () {
    displayResultsReload();
    // Generic helper to initialize single-select custom dropdowns
    function initSingleSelectDropdown(buttonId, contentId, textId, hiddenInputId) {
        const button = document.getElementById(buttonId);
        const content = document.getElementById(contentId);
        const text = document.getElementById(textId);
        const hiddenInput = document.getElementById(hiddenInputId);
        const arrow = button === null || button === void 0 ? void 0 : button.querySelector('.dropdown-arrow');
        if (button && content && hiddenInput) {
            button.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                // Close other dropdowns first
                const allContents = document.querySelectorAll('.dropdown-content');
                allContents.forEach(c => {
                    var _a, _b;
                    if (c !== content) {
                        c.classList.remove('show');
                        (_b = (_a = c.parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('.dropdown-arrow')) === null || _b === void 0 ? void 0 : _b.classList.remove('open');
                    }
                });
                content.classList.toggle('show');
                arrow === null || arrow === void 0 ? void 0 : arrow.classList.toggle('open');
            });
            content.querySelectorAll('.dropdown-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const value = option.getAttribute('data-value') || '';
                    const label = option.textContent || '';
                    hiddenInput.value = value;
                    if (text) {
                        text.textContent = label;
                    }
                    content.classList.remove('show');
                    arrow === null || arrow === void 0 ? void 0 : arrow.classList.remove('open');
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
    const targetSection = document.getElementById("articles-card");
    if (btn) {
        // Show button when scrolling down
        window.addEventListener("scroll", () => {
            if (window.scrollY > 1200) {
                btn.style.display = "block";
            }
            else {
                btn.style.display = "none";
            }
        });
        // Scroll to top on click
        btn.addEventListener("click", () => {
            targetSection === null || targetSection === void 0 ? void 0 : targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }
    // Wire up custom number input arrows
    function setupCustomNumberInput(inputId) {
        const input = document.getElementById(inputId);
        if (!input)
            return;
        const container = input.closest('.number-input-container');
        if (!container)
            return;
        const upBtn = container.querySelector('.number-input-arrow.up');
        const downBtn = container.querySelector('.number-input-arrow.down');
        upBtn === null || upBtn === void 0 ? void 0 : upBtn.addEventListener('click', () => {
            const val = parseInt(input.value) || 0;
            const max = input.max ? parseInt(input.max) : 100;
            if (val < max) {
                input.value = (val + 1).toString();
                input.dispatchEvent(new Event('change'));
            }
        });
        downBtn === null || downBtn === void 0 ? void 0 : downBtn.addEventListener('click', () => {
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
    const websiteDropdownArrow = websiteDropdownButton === null || websiteDropdownButton === void 0 ? void 0 : websiteDropdownButton.querySelector('.dropdown-arrow');
    if (websiteDropdownButton && websiteDropdownContent) {
        websiteDropdownButton.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            // Close other dropdowns first
            const allContents = document.querySelectorAll('.dropdown-content');
            allContents.forEach(c => {
                var _a, _b;
                if (c !== websiteDropdownContent) {
                    c.classList.remove('show');
                    (_b = (_a = c.parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('.dropdown-arrow')) === null || _b === void 0 ? void 0 : _b.classList.remove('open');
                }
            });
            websiteDropdownContent.classList.toggle('show');
            websiteDropdownArrow === null || websiteDropdownArrow === void 0 ? void 0 : websiteDropdownArrow.classList.toggle('open');
        });
        // Update dropdown text when selections change
        const updateWebsiteDropdownText = () => {
            var _a, _b;
            const checkedBoxes = websiteDropdownContent.querySelectorAll('input[name="websites"]:checked');
            const count = checkedBoxes.length;
            if (websiteDropdownText) {
                if (count === 0) {
                    websiteDropdownText.textContent = 'Select websites...';
                }
                else if (count === 1) {
                    const label = ((_b = (_a = checkedBoxes[0].parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('label')) === null || _b === void 0 ? void 0 : _b.textContent) || '';
                    websiteDropdownText.textContent = label;
                }
                else {
                    websiteDropdownText.textContent = `${count} websites selected`;
                }
            }
        };
        // Add change listeners to checkboxes
        websiteDropdownContent.querySelectorAll('input[name="websites"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateWebsiteDropdownText);
        });
        // Prevent dropdown from closing when clicking inside
        websiteDropdownContent.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    }
    // update button text for save and clear when articles are selected 
    const clearButtonTextContent = document.getElementById("clearArticlesBtn");
    const saveButtonTextContent = document.getElementById("saveArticlesBtn");
    const emailButtonTextContent = document.getElementById("emailArticlesBtn");
    const saveToFileBtn = document.getElementById("saveToFileBtn");
    const clearSelectionsButton = document.getElementById('selectionsBtn');
    if (clearSelectionsButton && clearButtonTextContent && saveButtonTextContent && emailButtonTextContent && saveToFileBtn) {
        const updateArticlesButton = () => {
            const count = getCheckedArticles().length;
            if (count == 0) {
                clearButtonTextContent.textContent = "Clear All";
                saveButtonTextContent.textContent = "Save All";
                emailButtonTextContent.textContent = "Email All";
                saveToFileBtn.textContent = "Save to File";
                clearSelectionsButton.style.display = "none";
            }
            else {
                clearButtonTextContent.textContent = `Clear ${count} Articles`;
                saveButtonTextContent.textContent = `Save ${count} Articles`;
                emailButtonTextContent.textContent = `Email ${count} Articles`;
                saveToFileBtn.textContent = `Save ${count} to File`;
                clearSelectionsButton.style.display = "inline-block";
                clearSelectionsButton.textContent = `Clear ${count} Selections`;
            }
        };
        // Add change listeners to checkboxes
        document.addEventListener("change", (event => {
            const target = event.target;
            if (target.matches('input[name="articleCheckBox"]')) {
                updateArticlesButton();
            }
        }));
        // clear selections functionality
        clearSelectionsButton.addEventListener('click', function (e) {
            clearCheckboxes();
            updateArticlesButton();
        });
    }
    // Dropdown functionality for database search
    const databaseWebsiteDropdownButton = document.getElementById('databaseWebsiteDropdownButton');
    const databaseWebsiteDropdownContent = document.getElementById('databaseWebsiteDropdownContent');
    const databaseWebsiteDropdownText = document.getElementById('databaseWebsiteDropdownText');
    const databaseWebsiteDropdownArrow = databaseWebsiteDropdownButton === null || databaseWebsiteDropdownButton === void 0 ? void 0 : databaseWebsiteDropdownButton.querySelector('.dropdown-arrow');
    if (databaseWebsiteDropdownButton && databaseWebsiteDropdownContent) {
        databaseWebsiteDropdownButton.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            // Close other dropdowns first
            const allContents = document.querySelectorAll('.dropdown-content');
            allContents.forEach(c => {
                var _a, _b;
                if (c !== databaseWebsiteDropdownContent) {
                    c.classList.remove('show');
                    (_b = (_a = c.parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('.dropdown-arrow')) === null || _b === void 0 ? void 0 : _b.classList.remove('open');
                }
            });
            databaseWebsiteDropdownContent.classList.toggle('show');
            databaseWebsiteDropdownArrow === null || databaseWebsiteDropdownArrow === void 0 ? void 0 : databaseWebsiteDropdownArrow.classList.toggle('open');
        });
        // Update dropdown text when selections change
        const updateDatabaseWebsiteDropdownText = () => {
            var _a, _b;
            const checkedBoxes = databaseWebsiteDropdownContent.querySelectorAll('input[name="database-websites"]:checked');
            const count = checkedBoxes.length;
            if (databaseWebsiteDropdownText) {
                if (count === 0) {
                    databaseWebsiteDropdownText.textContent = 'Select websites...';
                }
                else if (count === 1) {
                    const label = ((_b = (_a = checkedBoxes[0].parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('label')) === null || _b === void 0 ? void 0 : _b.textContent) || '';
                    databaseWebsiteDropdownText.textContent = label;
                }
                else {
                    databaseWebsiteDropdownText.textContent = `${count} websites selected`;
                }
            }
        };
        // Add change listeners to checkboxes
        databaseWebsiteDropdownContent.querySelectorAll('input[name="database-websites"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateDatabaseWebsiteDropdownText);
        });
        // Prevent dropdown from closing when clicking inside
        databaseWebsiteDropdownContent.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    }
    // Close dropdowns when clicking outside
    document.addEventListener('click', function (event) {
        const customDropdowns = document.querySelectorAll('.custom-dropdown');
        customDropdowns.forEach(dropdown => {
            const button = dropdown.querySelector('.dropdown-button');
            const content = dropdown.querySelector('.dropdown-content');
            const arrow = button === null || button === void 0 ? void 0 : button.querySelector('.dropdown-arrow');
            if (button && content && !button.contains(event.target) && !content.contains(event.target)) {
                content.classList.remove('show');
                arrow === null || arrow === void 0 ? void 0 : arrow.classList.remove('open');
            }
        });
    });
    // Select All functionality for site search
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function () {
            const websiteCheckboxes = document.querySelectorAll('input[name="websites"]');
            websiteCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            // Update dropdown text
            if (websiteDropdownText) {
                const count = this.checked ? websiteCheckboxes.length : 0;
                if (count === 0) {
                    websiteDropdownText.textContent = 'Select websites...';
                }
                else {
                    websiteDropdownText.textContent = `${count} websites selected`;
                }
            }
        });
    }
    // Select All functionality for database search
    const databaseSelectAllCheckbox = document.getElementById('databaseSelectAll');
    if (databaseSelectAllCheckbox) {
        databaseSelectAllCheckbox.addEventListener('change', function () {
            const websiteCheckboxes = document.querySelectorAll('input[name="database-websites"]');
            websiteCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            // Update dropdown text
            if (databaseWebsiteDropdownText) {
                const count = this.checked ? websiteCheckboxes.length : 0;
                if (count === 0) {
                    databaseWebsiteDropdownText.textContent = 'Select websites...';
                }
                else {
                    databaseWebsiteDropdownText.textContent = `${count} websites selected`;
                }
            }
        });
    }
    // Clear Articles button functionality
    const clearArticlesBtn = document.getElementById('clearArticlesBtn');
    if (clearArticlesBtn) {
        clearArticlesBtn.addEventListener('click', function () {
            const activityLog = document.getElementById('activity-log');
            const articlesCard = document.getElementById('articles-card');
            const articleCheckboxes = getCheckedArticles();
            if (activityLog && articlesCard) {
                const children = activityLog.querySelectorAll(".article-container");
                if (articleCheckboxes.length == 0) {
                    children.forEach(child => child.remove());
                    localStorage.clear();
                    saveButtonTextContent.style.display = "none";
                    emailButtonTextContent.style.display = "none";
                    saveToFileBtn.style.display = "none";
                    clearArticlesBtn.style.display = "none";
                }
                else {
                    clearArticles();
                    clearCheckboxes();
                    // Restore button state
                    clearButtonTextContent.textContent = "Clear All";
                    saveButtonTextContent.textContent = "Save All";
                    emailButtonTextContent.textContent = "Email All";
                    saveToFileBtn.textContent = "Save to File";
                    clearSelectionsButton.style.display = "none";
                }
            }
        });
    }
    // email articles functionality 
    const modal = document.getElementById("emailModal");
    const cancelBtn = document.getElementById("cancelBtn");
    const submitBtn = document.getElementById("submitBtn");
    const emailInput = document.getElementById("emailInput");
    const emailArticlesBtn = document.getElementById('emailArticlesBtn');
    if (emailArticlesBtn) {
        emailArticlesBtn.addEventListener("click", showModal);
        cancelBtn.addEventListener("click", hideModal);
        // Enable submit only if email is valid
        emailInput.addEventListener("input", () => {
            const email = emailInput.value;
            const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            submitBtn.disabled = !isValid;
        });
        submitBtn.addEventListener("click", async function (e) {
            hideModal();
            if (submitBtn.disabled === true) {
                return;
            }
            let articleCheckboxes = getCheckedArticles();
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
                }
                else {
                    alert(`Error: ${response.message}`);
                }
            }
            catch (error) {
                alert('Save failed. Please try again.');
            }
            finally {
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
    }
    // Save Articles button functionality
    const saveArticlesBtn = document.getElementById('saveArticlesBtn');
    if (saveArticlesBtn) {
        saveArticlesBtn.addEventListener('click', async function (e) {
            let articleCheckboxes = getCheckedArticles();
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
                }
                else {
                    alert(`Error: ${response.message}`);
                }
            }
            catch (error) {
                alert('Save failed. Please try again.');
            }
            finally {
                // Restore button state
                saveArticlesBtn.textContent = originalText;
                saveArticlesBtn.disabled = false;
            }
        });
    }
    const saveToFileBtnElement = document.getElementById('saveToFileBtn');
    if (saveToFileBtnElement) {
        saveToFileBtnElement.addEventListener("click", function (e) {
            e.preventDefault();
            const activityLog = document.getElementById('activity-log');
            if (!activityLog)
                return;
            const checkedArticles = getCheckedArticles();
            let selectedContainers = [];
            if (checkedArticles.length > 0) {
                checkedArticles.forEach(url => {
                    const cb = document.querySelector(`input[name="articleCheckBox"][value="${url}"]`);
                    const container = cb === null || cb === void 0 ? void 0 : cb.closest('.article-container');
                    if (container) {
                        selectedContainers.push(container);
                    }
                });
            }
            else {
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
            // Combine HTML and clean up checkboxes
            let htmlContent = "";
            selectedContainers.forEach(container => {
                const clone = container.cloneNode(true);
                const checkbox = clone.querySelector('input[name="articleCheckBox"]');
                if (checkbox) {
                    checkbox.remove();
                }
                htmlContent += clone.outerHTML + "\n";
            });
            // Wrap in standard HTML template for saving
            const fullHtml = `<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Saved Summaries</title>
                    <style>
                        body {
                            background-color: #09090b;
                            color: #f4f4f5;
                            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                            padding: 2rem;
                            max-width: 800px;
                            margin: 0 auto;
                        }

                        .article-container {
                            margin-bottom: 2rem;
                            padding: 1.75rem;
                            border: 1px solid #27272a;
                            border-radius: 8px;
                            background-color: #18181b;
                        }

                        .article-analysis {
                            font-family: inherit;
                        }

                        /* Table styles inside saved file */
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 1.5rem;
                            background-color: #18181b;
                            border: 1px solid #27272a;
                            border-radius: 6px;
                            overflow: hidden;
                        }

                        th, td {
                            border: 1px solid #27272a;
                            padding: 0.75rem 1rem;
                            font-size: 0.85rem;
                            text-align: left;
                        }

                        th {
                            background-color: rgba(255, 255, 255, 0.02);
                            color: #a1a1aa;
                            font-weight: 600;
                        }

                        td {
                            color: #f4f4f5;
                        }

                        /* Link Preview Card */
                        .link-preview-card {
                            display: flex;
                            gap: 1.25rem;
                            background-color: #09090b;
                            border: 1px solid #27272a;
                            border-radius: 6px;
                            padding: 1.25rem;
                            margin-top: 0.5rem;
                            overflow: hidden;
                            align-items: stretch;
                            text-align: left;
                        }

                        .link-preview-details {
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            gap: 0.5rem;
                            justify-content: center;
                        }

                        .link-preview-site {
                            font-size: 0.75rem;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                            color: #a1a1aa;
                            font-weight: 600;
                        }

                        .link-preview-title {
                            font-size: 1.05rem;
                            font-weight: 600;
                            color: #f4f4f5;
                            text-decoration: underline;
                            line-height: 1.4;
                        }

                        .link-preview-desc {
                            font-size: 0.85rem;
                            color: #a1a1aa;
                            line-height: 1.5;
                            margin: 0;
                        }

                        .link-preview-meta {
                            display: flex;
                            align-items: center;
                            gap: 0.5rem;
                            font-size: 0.75rem;
                            color: #a1a1aa;
                            margin-top: 0.25rem;
                        }

                        .link-preview-divider {
                            color: #3f3f46;
                        }

                        .link-preview-thumbnail {
                            width: 120px;
                            min-width: 120px;
                            height: 90px;
                            border-radius: 4px;
                            overflow: hidden;
                            border: 1px solid #27272a;
                            align-self: center;
                            display: flex;
                        }

                        .link-preview-thumbnail img {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        }

                        /* Sentiment section inside saved file */
                        .sentiment-section {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                            gap: 1rem;
                        }

                        .sentiment-block {
                            padding: 1rem 1.5rem;
                            border-radius: 8px;
                            border: 1px solid #27272a;
                            background-color: #18181b;
                        }

                        .sentiment-block.positive {
                            border-left: 5px solid #22c55e;
                        }

                        .sentiment-block.neutral {
                            border-left: 5px solid #ef4444;
                        }

                        .sentiment-block.negative {
                            border-left: 5px solid #71717a;
                        }

                        h2 {
                            font-size: 1.25rem;
                            margin-top: 1.5rem;
                            margin-bottom: 0.75rem;
                            color: #f4f4f5;
                        }

                        h3 {
                            margin-top: 0;
                            color: #f4f4f5;
                        }

                        ul {
                            background-color: #18181b;
                            padding: 1rem 1.5rem;
                            border: 1px solid #27272a;
                            border-radius: 8px;
                            margin-bottom: 2rem;
                            color: #e4e4e7;
                        }

                        li {
                            margin-bottom: 0.5rem;
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
    const quickActionsForm = document.getElementById('quickActionsForm');
    if (quickActionsForm) {
        quickActionsForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const values = getSiteSearchValues();
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
            const submitButton = quickActionsForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Searching...';
            submitButton.disabled = true;
            try {
                showSearchProgress();
                // Make streaming API request to backend
                const response = await makeApiRequest_stream('/search-site-stream', values, (eventData) => {
                    updateSearchProgress(eventData.stage, eventData.progress, eventData.message);
                });
                if (response.status === 'success' && response.html) {
                    displayResults(response);
                }
                else {
                    alert(`Error: ${response.message}`);
                }
            }
            catch (error) {
                alert('Search failed. Please try again.');
            }
            finally {
                setTimeout(() => {
                    hideSearchProgress();
                }, 1200);
                // Restore button state
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
    const recentBtn = document.getElementById('recent-ten');
    if (recentBtn) {
        recentBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            const originalText = recentBtn.textContent;
            recentBtn.textContent = 'Requesting...';
            recentBtn.disabled = true;
            try {
                const response = await makeApiRequest_recent('/recent-saves');
                if (response.status === 'success') {
                    displayResults(response);
                }
                else {
                    alert(`Error: ${response.message}`);
                }
            }
            catch (error) {
                alert('Save failed. Please try again.');
            }
            finally {
                // Restore button state
                recentBtn.textContent = originalText;
                recentBtn.disabled = false;
            }
        });
    }
    const allSavedBtn = document.getElementById('saved-all');
    if (allSavedBtn) {
        allSavedBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            const originalText = allSavedBtn.textContent;
            allSavedBtn.textContent = 'Requesting...';
            allSavedBtn.disabled = true;
            try {
                const response = await makeApiRequest_recent('/all-saved');
                if (response.status === 'success') {
                    displayResults(response);
                }
                else {
                    alert(`Error: ${response.message}`);
                }
            }
            catch (error) {
                alert('Save failed. Please try again.');
            }
            finally {
                // Restore button state
                allSavedBtn.textContent = originalText;
                allSavedBtn.disabled = false;
            }
        });
    }
    // Form submission handler for database search
    const databaseSearchForm = document.getElementById('databaseSearchForm');
    if (databaseSearchForm) {
        databaseSearchForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const values = getDatabaseSearchValues();
            // // Validation
            // if (!values.searchTerms.trim()) {
            //     alert('Please enter search terms');
            //     return;
            // }
            // if (values.websites.length === 0) {
            //     alert('Please select at least one website');
            //     return;
            // }
            // Show loading state
            const submitButton = databaseSearchForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Searching...';
            submitButton.disabled = true;
            try {
                // Make API request to backend
                const response = await makeApiRequestDatabase('/search-database', values);
                if (response.status === 'success') {
                    displayResults(response);
                }
                else {
                    alert(`Error: ${response.message}`);
                }
            }
            catch (error) {
                //console.error('Database search failed:', error);
                alert('Database search failed. Please try again.');
            }
            finally {
                // Restore button state
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
});
