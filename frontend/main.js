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
            }
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
            body: JSON.stringify({ data, email_address })
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
            body: JSON.stringify({ data })
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
// Function to make API requests for site search
async function makeApiRequest(endpoint, data) {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(url);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
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
// Function to make API requests for site search
async function makeApiRequestDatabase(endpoint, data) {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
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
    // Check if this is the first result - if so, clear the default "No articles found" message
    const isFirstResult = activityLog.children.length === 0;
    if (isFirstResult) {
        const saveButtonTextContent = document.getElementById("saveArticlesBtn");
        const emailButtonTextContent = document.getElementById("emailArticlesBtn");
        const clearArticlesBtn = document.getElementById('clearArticlesBtn');
        saveButtonTextContent.style.display = "inline-block";
        emailButtonTextContent.style.display = "inline-block";
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
        const clearArticlesBtn = document.getElementById('clearArticlesBtn');
        saveButtonTextContent.style.display = "inline-block";
        emailButtonTextContent.style.display = "inline-block";
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
        const clearArticlesBtn = document.getElementById('clearArticlesBtn');
        saveButtonTextContent.style.display = "none";
        emailButtonTextContent.style.display = "none";
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    // Get all checked website checkboxes
    const websiteCheckboxes = document.querySelectorAll('input[name="websites"]:checked');
    const websites = Array.from(websiteCheckboxes).map(checkbox => checkbox.value);
    // console.log(Number((document.getElementById('site-day-from') as HTMLSelectElement).value) || n_day)
    // console.log(Number((document.getElementById('site-month-from') as HTMLSelectElement).value) || n_month)
    // console.log(Number((document.getElementById('site-year-from') as HTMLSelectElement).value) || n_year)
    // console.log(Number((document.getElementById('site-day-to') as HTMLSelectElement).value) || n_day)
    // console.log(Number((document.getElementById('site-month-to') as HTMLSelectElement).value) || n_month)
    // console.log(Number((document.getElementById('site-year-to') as HTMLSelectElement).value) || n_day)
    return {
        websites: websites || ["0"],
        searchTerms: ((_a = document.getElementById('search')) === null || _a === void 0 ? void 0 : _a.value) || "MSI",
        limit: Number((_b = document.getElementById('amount')) === null || _b === void 0 ? void 0 : _b.value) || 1,
        day_from: Number((_c = document.getElementById('site-day-from')) === null || _c === void 0 ? void 0 : _c.value) || 1,
        month_from: Number((_d = document.getElementById('site-month-from')) === null || _d === void 0 ? void 0 : _d.value) || 1,
        year_from: Number((_e = document.getElementById('site-year-from')) === null || _e === void 0 ? void 0 : _e.value) || 2025,
        day_to: Number((_f = document.getElementById('site-day-to')) === null || _f === void 0 ? void 0 : _f.value) || n_day,
        month_to: Number((_g = document.getElementById('site-month-to')) === null || _g === void 0 ? void 0 : _g.value) || n_month,
        year_to: Number((_h = document.getElementById('site-year-to')) === null || _h === void 0 ? void 0 : _h.value) || n_year,
        keywords: ((_j = document.getElementById('keywords')) === null || _j === void 0 ? void 0 : _j.value) || ""
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
    // Dropdown functionality for site search
    const websiteDropdownButton = document.getElementById('websiteDropdownButton');
    const websiteDropdownContent = document.getElementById('websiteDropdownContent');
    const websiteDropdownText = document.getElementById('websiteDropdownText');
    const websiteDropdownArrow = websiteDropdownButton === null || websiteDropdownButton === void 0 ? void 0 : websiteDropdownButton.querySelector('.dropdown-arrow');
    if (websiteDropdownButton && websiteDropdownContent) {
        websiteDropdownButton.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
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
    const clearSelectionsButton = document.getElementById('selectionsBtn');
    if (clearSelectionsButton && clearButtonTextContent && saveButtonTextContent && emailButtonTextContent) {
        const updateArticlesButton = () => {
            const checkedBoxes = document.querySelectorAll('input[name="articleCheckBox"]:checked');
            const count = checkedBoxes.length;
            if (count == 0) {
                clearButtonTextContent.textContent = "Clear All";
                saveButtonTextContent.textContent = "Save All";
                emailButtonTextContent.textContent = "Email All";
                clearSelectionsButton.style.display = "none";
            }
            else {
                clearButtonTextContent.textContent = `Clear ${count} Articles`;
                saveButtonTextContent.textContent = `Save ${count} Articles`;
                emailButtonTextContent.textContent = `Email ${count} Articles`;
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
        if (websiteDropdownButton && websiteDropdownContent && !websiteDropdownButton.contains(event.target)) {
            websiteDropdownContent.classList.remove('show');
            websiteDropdownArrow === null || websiteDropdownArrow === void 0 ? void 0 : websiteDropdownArrow.classList.remove('open');
        }
        if (databaseWebsiteDropdownButton && databaseWebsiteDropdownContent && !databaseWebsiteDropdownButton.contains(event.target)) {
            databaseWebsiteDropdownContent.classList.remove('show');
            databaseWebsiteDropdownArrow === null || databaseWebsiteDropdownArrow === void 0 ? void 0 : databaseWebsiteDropdownArrow.classList.remove('open');
        }
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
                    clearArticlesBtn.style.display = "none";
                }
                else {
                    clearArticles();
                    clearCheckboxes();
                    // Restore button state
                    clearButtonTextContent.textContent = "Clear All";
                    saveButtonTextContent.textContent = "Save All";
                    emailButtonTextContent.textContent = "Email All";
                    clearSelectionsButton.style.display = "none";
                }
            }
        });
    }
    // clear selections functionality
    if (clearSelectionsButton) {
        clearSelectionsButton.addEventListener('click', function (e) {
            clearCheckboxes();
            clearButtonTextContent.textContent = "Clear All";
            saveButtonTextContent.textContent = "Save All";
            emailButtonTextContent.textContent = "Email All";
            clearSelectionsButton.style.display = "none";
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
                // Make API request to backend
                const response = await makeApiRequest('/search-site', values);
                if (response.status === 'success') {
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
            if (values.websites.length === 0) {
                alert('Please select at least one website');
                return;
            }
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
