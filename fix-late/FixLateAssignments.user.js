// ==UserScript==
// @name         Fix Late Assignments
// @namespace    https://github.com/agessaman
// @version      1.6
// @description  Add Fix Late Assignments Script to Overflow Menu and as a direct button
// @author       Adam Gessaman
// @match        https://*.instructure.com/courses/*/assignments
// @match        https://*.instructure.com/courses/*/assignments/*
// @match        https://*.instructure.com/courses/*/quizzes/*
// @match        https://*.instructure.com/courses/*/quizzes
// @match        https://*.instructure.com/courses/*/discussion_topics/*
// @match        https://*.instructure.com/courses/*/discussion_topics
// @grant        GM_addStyle
// @updateURL    https://github.com/agessaman/canvas-tools/raw/main/fix-missing/FixLateAssignments.user.js
// ==/UserScript==

(function() {
    'use strict';

    const config = {
        missing: true,
        null_missing: false,
        zero_missing: true,
        late: false,
        reset: false,
        debug: true,
    };

    let totalUpdated = 0;
    let errors = [];

    function log(message) {
        if (config.debug) {
            console.log(`[Fix Late Assignments] ${message}`);
        }
    }

    // Toast notification system
    GM_addStyle(`
        #toastNotification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: 2px solid #0077C5;
            border-radius: 5px;
            padding: 10px;
            max-width: 300px;
            z-index: 9999;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        #toastNotification h3 {
            margin: 0 0 10px 0;
            color: #0077C5;
        }
        #toastNotification p {
            margin: 5px 0;
        }
        #toastClose {
            position: absolute;
            top: 5px;
            right: 5px;
            cursor: pointer;
            font-weight: bold;
        }
        #fixLateButton {
            margin-top: 10px;
        }
    `);

    function showToast(message, title = "Script Execution Result") {
        const toast = document.createElement('div');
        toast.id = 'toastNotification';
        toast.innerHTML = `
            <span id="toastClose">&times;</span>
            <h3>${title}</h3>
            ${message}
        `;
        document.body.appendChild(toast);

        const closeButton = document.getElementById('toastClose');
        closeButton.addEventListener('click', () => {
            document.body.removeChild(toast);
        });

        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 10000);
    }

    const courseRegex = new RegExp(
        '^/courses/(\\d+)/(assignments|quizzes|discussion_topics)(?:/(\\d+))?(/edit)?'
    );
    const courseMatch = courseRegex.exec(window.location.pathname);

    if (!courseMatch) {
        log('No course match found. Exiting script.');
        return;
    }

    const courseId = courseMatch[1];
    const contextType = courseMatch[2];
    const contextId = typeof courseMatch[3] === 'undefined' ? false : courseMatch[3];
    const isSingleItem = !!contextId;

    let listUrl = '';
    const baseUrl = `/api/v1/courses/${courseId}`;

    function setupListUrl() {
        if (isSingleItem) {
            listUrl = `${baseUrl}/${contextType}/${contextId}`;
        } else {
            switch (contextType) {
                case 'assignments':
                    listUrl = `${baseUrl}/assignment_groups?include[]=assignments&exclude_response_fields[]=rubric&exclude_response_fields[]=description&override_assignment_dates=false`;
                    break;
                case 'quizzes':
                    listUrl = `${baseUrl}/quizzes?per_page=100`;
                    break;
                case 'discussion_topics':
                    listUrl = `${baseUrl}/discussion_topics?exclude_assignment_descriptions=true&plain_messages=true&per_page=100`;
                    break;
            }
        }
        log(`List URL set to: ${listUrl}`);
    }

    function addMenuItem(menuContainer) {
        if (menuContainer && !document.getElementById("ag_late")) {
            const newLI = document.createElement("li");
            newLI.setAttribute("class", "ui-menu-item");
            newLI.setAttribute("role", "presentation");
            newLI.setAttribute("id", "ag_late");

            const newA = document.createElement("a");
            newA.innerHTML = "<i class='icon-clock'></i> Fix Late Assignments";
            newA.href = "#";
            newA.addEventListener('click', fix_late, {
                once: true,
            });
            newLI.appendChild(newA);
            menuContainer.appendChild(newLI);
            log('Menu item added successfully');
        }
    }

    function addObserver() {
        const menuSelectors = [
            '.ic-Action-header__SecondaryButton',
            '#toolbar-1',
            '#al-links',
            '#ui-id-1'
        ];

        log('Starting observer for menu container');
        new MutationObserver((mutations, observer) => {
            for (const selector of menuSelectors) {
                const menuContainer = document.querySelector(selector);
                if (menuContainer) {
                    addMenuItem(menuContainer);
                    observer.disconnect();
                    log(`Menu container found with selector: ${selector}`);
                    return;
                }
            }
        }).observe(document.body, {childList: true, subtree: true});
    }

    function fix_late() {
        log('Beginning to set labels and remove late penalties.');
        totalUpdated = 0;
        errors = [];

        const promise = isSingleItem ? 
            getAPI(listUrl, 'single_item') :
            getAPI(listUrl, contextType);

        promise
            .catch(e => {
                log(`Error processing ${isSingleItem ? 'single item' : contextType}: ${e}`);
                errors.push(e.toString());
            })
            .finally(() => {
                log(`Done setting labels for ${isSingleItem ? 'single item' : 'all ' + contextType}`);
                const message = `
                    <p>Total assignments updated: ${totalUpdated}</p>
                    ${errors.length > 0 ? `<p>Errors encountered:</p><ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
                `;
                showToast(message);
            });
    }

    function getAPI(url, handler) {
        log(`Fetching data from: ${url}`);
        const options = {
            method: 'GET',
            headers: {
                'content-type': 'application/json',
                'accept': 'application/json',
            },
            credentials: 'include'
        };

        return fetch(url, options)
            .then(res => {
                const linkHeader = res.headers.get('Link');
                const nextUrl = getNextUrl(linkHeader);
                return res.json().then(data => ({data, nextUrl}));
            })
            .then(({data, nextUrl}) => {
                log(`Data received for ${handler}. Processing...`);
                return processData(data, handler).then(() => {
                    if (nextUrl) {
                        log(`Found next page. Fetching from: ${nextUrl}`);
                        return getAPI(nextUrl, handler);
                    }
                });
            });
    }

    function getNextUrl(linkHeader) {
        if (!linkHeader) return null;
        const links = linkHeader.split(',');
        const nextLink = links.find(link => link.includes('rel="next"'));
        if (!nextLink) return null;
        const match = nextLink.match(/<(.*)>/);
        return match ? match[1] : null;
    }

    function processData(data, handler) {
        switch (handler) {
            case 'single_item':
                return processSingleItem(data);
            case 'assignments':
            case 'quizzes':
            case 'discussion_topics':
                return processItems(data, handler);
            case 'submissions':
                return processSubmissions(data);
            default:
                log(`Unknown handler: ${handler}`);
                return Promise.resolve(true);
        }
    }

    function processSingleItem(data) {
        log('Processing single item:', data);
        const itemId = checkItem(data);
        if (itemId) {
            return getSubmissions([{id: itemId, type: contextType, data: data}]);
        }
        return Promise.resolve(true);
    }

    function processItems(data, type) {
        const itemIds = [];
        if (Array.isArray(data)) {
            if (type === 'assignments') {
                data.forEach(group => {
                    group.assignments.forEach(a => {
                        const id = checkItem(a);
                        if (id) {
                            itemIds.push({id, type: 'assignments', data: a});
                        }
                    });
                });
            } else {
                data.forEach(item => {
                    const id = checkItem(item);
                    if (id) {
                        itemIds.push({id, type, data: item});
                    }
                });
            }
        } else {
            const id = checkItem(data);
            if (id) {
                itemIds.push({id, type, data: data});
            }
        }
        log(`Found ${itemIds.length} items to process`);
        return getSubmissions(itemIds);
    }

    function checkItem(item) {
        if (item.published && item.due_at) {
            log(`Item ${item.id} is published and has a due date. Processing.`);
            return item.id;
        }
        log(`Item ${item.id} skipped. Published: ${item.published}, Due date: ${item.due_at}`);
        return null;
    }

    function getSubmissions(items) {
        log(`Getting submissions for ${items.length} items`);
        const submissionPromises = items.map(item => {
            if (item.type === 'quizzes') {
                if (item.data.assignment_id) {
                    return getAssignmentSubmissions(item.data.assignment_id);
                } else {
                    log(`Quiz ${item.id} does not have an associated assignment. Skipping.`);
                    return Promise.resolve([]);
                }
            } else {
                return getAssignmentSubmissions(item.id);
            }
        });
        return Promise.all(submissionPromises);
    }

    function getAssignmentSubmissions(assignmentId) {
        const url = `${baseUrl}/assignments/${assignmentId}/submissions?include[]=submission_history&per_page=100`;
        return getAPI(url, 'submissions');
    }

    function processSubmissions(submissions) {
        log(`Processing ${submissions.length} submissions`);
        const updatePromises = submissions.filter(submission => submission.late).map(submission => {
            log(`Submission ${submission.id} is late. Removing late penalty.`);
            return removeLatePenalty(submission);
        });
        return Promise.all(updatePromises);
    }

    function removeLatePenalty(submission) {
        log(`Removing late penalty for submission ${submission.id}`);
        const url = `${baseUrl}/assignments/${submission.assignment_id}/submissions/${submission.user_id}`;
        const data = {
            submission: {
                late_policy_status: 'none'
            }
        };
        return putAPI(url, data)
            .then(() => {
                totalUpdated++;
            })
            .catch(e => {
                errors.push(`Failed to update submission ${submission.id}: ${e.toString()}`);
            });
    }

    function putAPI(url, data) {
        log(`Sending PUT request to: ${url}`);
        const csrfToken = getCsrfToken();
        if (!csrfToken) {
            log('CSRF token not found. Aborting PUT request.');
            return Promise.reject(new Error('CSRF token not found'));
        }
        const options = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify(data)
        };

        return fetch(url, options)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(json => {
                log(`Successfully updated submission: ${json.id}`);
                return json;
            })
            .catch(e => {
                log(`Error updating submission: ${e}`);
                throw e;
            });
    }

    function getCsrfToken() {
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        if (csrfToken) {
            return csrfToken.getAttribute('content');
        }
        // Fallback method to get CSRF token from cookies
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === '_csrf_token') {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    function addFixLateButton() {
        const speedGraderContainer = document.getElementById('speed_grader_link_container');
        if (speedGraderContainer) {
            const button = document.createElement('button');
            button.id = 'fixLateButton';
            button.className = 'btn button-sidebar-wide';
            button.innerHTML = '<i class="icon-clock"></i> Fix Late Assignments';
            button.addEventListener('click', fix_late);
            speedGraderContainer.insertAdjacentElement('afterend', button);
            log('Fix Late Assignments button added to the page');
        } else {
            log('Speed Grader container not found, button not added');
        }
    }

    function init() {
        setupListUrl();
        addObserver();
        addFixLateButton();
    }

    // Call the init function when the script loads
    init();
})();
