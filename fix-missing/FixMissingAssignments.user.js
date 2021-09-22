// ==UserScript==
// @name         Clear Missing Assignments
// @namespace    https://github.com/agessaman
// @version      0.2
// @description  Add Clear Missing Script to Overflow Menu
// @author       Adam Gessaman
// @match        https://*.instructure.com/courses/*/assignments
// @match        https://*.instructure.com/courses/*/assignments/*
// @grant        none
// @updateURL    https://github.com/agessaman/canvas-tools/raw/main/fix-missing/FixMissingAssignments.user.js
// ==/UserScript==


const config = {
    missing: true, // disable Missing labels, can be done at any time
    null_missing: false, // keep Missing labels on assignments with empty scores
    zero_missing: true, // keep Missing labels on assignments scored zero points
    late: false, // remove late labels, only affects things after submissions
    reset: false, // reset missing or late status to Canvas default,
    debug: false, // log potentially useful information about throttling timings to the console
};


const courseRegex = new RegExp(
    '^/courses/(\\d+)/(assignments|quizzes|discussion_topics)(?:/(\\d+))?'
);
const courseMatch = courseRegex.exec(window.location.pathname);

const courseId = courseMatch[1];
const contextType = courseMatch[2];
const contextId =
      typeof courseMatch[3] === 'undefined' ? false : courseMatch[3];

let listUrl = '';
const baseUrl = `/api/v1/courses/${courseId}`;
if (contextId) {
    listUrl = `${baseUrl}/${contextType}/${contextId}`;
}
switch (contextType) {
    case 'assignments':
        listUrl = `${baseUrl}/assignment_groups?include[]=assignments&exclude_response_fields[]=rubric&exclude_response_fields[]=description&override_assignment_dates=false`;
        break;
    case 'discussion_topics':
        listUrl = `${baseUrl}/discussion_topics?exclude_assignment_descriptions=true&plain_messages=true&per_page=30`;
        break;
    case 'quizzes':
        listUrl = `${baseUrl}/quizzes?per_page=30`;
        break;
}

new MutationObserver((mutations, observer) => {
    const keyElem = document.querySelector("#ui-id-1");
    if (keyElem) {
        var myEle = document.getElementById("ag_missing");
        if(!myEle){
            addMenuItem_assignments(keyElem);
        }
        observer.disconnect();
    }
}).observe(document.body, {attributes:true, childList:true, subtree:true});

new MutationObserver((mutations, observer) => {
    const keyElem = document.querySelector("#toolbar-1");
    if (keyElem) {
        var myEle = document.getElementById("ag_missing");
        if(!myEle){
            addMenuItem_assignments(keyElem);
        }
        observer.disconnect();
    }
}).observe(document.body, {attributes:true, childList:true, subtree:true});


function addMenuItem_assignments(jNode) {
    if (jNode)
    {
        var newLI = document.createElement("li");
        newLI.setAttribute("class", "ui-menu-item");
        newLI.setAttribute("role", "presentation");
        newLI.setAttribute("id", "ag_missing");

        var newA = document.createElement("a");
        newA.innerHTML = "<i class='icon-like'></i>Fix Missing Assignments";
        //newA.setAttribute("class", "btn btn-primary");
        newA.href = "#";
        newA.addEventListener('click', fix_missing, {
            once: true,
        });
        newLI.appendChild(newA);
        jNode.appendChild(newLI);

    }
}

function addMenuItem_single(jNode) {
    if (jNode)
    {
        var newLI = document.createElement("li");
        newLI.setAttribute("class", "ui-menu-item");
        newLI.setAttribute("role", "presentation");
        newLI.setAttribute("id", "ag_missing");

        var newA = document.createElement("a");
        newA.innerHTML = "<i class='icon-like'></i>Fix Missing Assignments";
        //newA.setAttribute("class", "btn btn-primary");
        newA.href = "#";
        newA.addEventListener('click', fix_missing, {
            once: true,
        });
        newLI.appendChild(newA);
        jNode.appendChild(newLI);

    }
}

function fix_missing() {
    'use strict';

    if (!courseMatch) {
        return;
    }

    let throttledFetch = window.fetch;

    setupBottleneck();

}

function setupBottleneck() {
    if (typeof Bottleneck === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/bottleneck@2/light.min.js';
        script.onload = () => setupBottleneck();
        document.head.appendChild(script);
    } else {
        const limiter = new Bottleneck({
            maxConcurrent: 10,
            minTime: 20,
        });
        throttledFetch = limiter.wrap(fetch);
        main();
    }
}

function main() {
    console.log('Beginning to set labels.');
    getAPI(listUrl, 'assignments')
        .catch(e => {
        if (!(e instanceof Bottleneck.BottleneckError)) {
            console.log(`Error: ${e}`);
        }
    })
        .finally(() => console.log('Done setting labels'));
}

function getCookie(name) {
    return document.cookie.split(';').reduce((a, c) => {
        const d = c.trim().split('=', 2);
        return d[0] === name ? decodeURIComponent(d[1]) : a;
    }, '');
}

function displayLimits(res, url) {
    if (config.debug) {
        const rate = res.headers.get('X-Rate-Limit-Remaining');
        const runtime = res.headers.get('X-Runtime');
        console.log(`${rate}\t${runtime}\t${res.status}\t${url}`);
    }
    return Promise.resolve(res);
}

function putAPI(url, data) {
    data.authenticity_token = getCookie('_csrf_token');
    const options = {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify(data),
        timeout: 3000,
    };
    return throttledFetch(url, options).then(res => displayLimits(res, url));
}

function getAPI(url, handler) {
    const options = {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
        },
        timeout: 3000,
    };
    const linkRegex = new RegExp('<([^>]+)>; rel="next"');
    let nextUrl = null;
    return throttledFetch(url, options)
        .then(res => displayLimits(res, url))
        .then(res => {
        if (res.ok) {
            const linkHeader = res.headers.get('link');
            const links = linkRegex.exec(linkHeader);
            if (links) {
                nextUrl = links[1];
            }
            return res.json();
        } else {
            return Promise.reject(res.status);
        }
    })
        .then(json => processData(json, handler))
        .then(() => (nextUrl ? getAPI(nextUrl, handler) : Promise.resolve(true)));
}

function processData(data, handler) {
    let p = Promise.resolve(true);
    switch (handler) {
        case 'assignments':
            p = processAssignments(data);
            break;
        case 'submissions':
            p = processSubmissions(data);
            break;
    }
    return p;
}

function processSubmissions(data) {
    const P = [];
    let status;
    for (let i = 0; i < data.length; i++) {
        const submission = data[i];
        status = false;
        if (submission.excused) {
            // Do not do anything with excused submissions
            continue;
        }
        let hasScore = false;
        if ((config.zero_missing && submission.score !== 0) || (config.null_missing && submission.score === null)) {
            hasScore = true;
        }

        if (config.reset) {
            if (submission.late_policy_status === 'none') {
                const isMissing = submission.submitted_at === null;
                const isLate =
                      submission.cached_due_date &&
                      submission.submitted_at &&
                      submission.submitted_at > submission.cached_due_date
                ? true
                : false;
                if ((config.missing && isMissing) || (config.late && isLate)) {
                    status = null;
                }
            }
        } else if (submission.late_policy_status === null && hasScore !== false) {
            if (
                (config.missing && !submission.late) ||
                (config.late && submission.late)
            ) {
                status = 'none';
            }
        }

        if (config.debug) {
            console.log(submission.user_id + ' late_policy_status: ' + submission.late_policy_status + ', late: ' + submission.late + ', hasScore: ' + hasScore + ', status: ' + status);
        }

        if (status !== false) {
            const parms = {
                submission: {
                    late_policy_status: status,
                },
            };
            const url =
                  '/api/v1/courses/' +
                  courseId +
                  '/assignments/' +
                  submission.assignment_id +
                  '/submissions/' +
                  submission.user_id;
            P.push(putAPI(url, parms));
        }
    }
    return Promise.all(P);
}

function processAssignments(data) {
    const assignmentIds = [];
    let id = null;
    if (!Array.isArray(data)) {
        id = checkAssignment(data);
        if (id) {
            assignmentIds.push(id);
        }
    } else {
        if (contextType === 'assignments') {
            data.forEach(group => {
                group.assignments.forEach(a => {
                    id = checkAssignment(a);
                    if (id) {
                        assignmentIds.push(id);
                    }
                });
            });
        } else {
            data.forEach(a => {
                id = checkAssignment(a);
                if (id) {
                    assignmentIds.push(id);
                }
            });
        }
    }
    return getSubmissions(assignmentIds);
}

function checkAssignment(a) {
    const types = [
        'none',
        'not_graded',
        'on_paper',
        'wiki_page',
        'external_tool',
    ];
    let valid = false;
    if (contextId === false || contextId == a.id) {
        let dueAt = false;
        let assignmentId = false;
        let extra = true;
        const published = a.published;
        switch (contextType) {
            case 'assignments':
                assignmentId = a.id;
                dueAt = a.due_at;
                extra = !a.submission_types.some(t => types.indexOf(t) > -1);
                break;
            case 'discussion_topics':
                assignmentId = a.assignment_id;
                dueAt =
                    typeof a.assignment !== 'undefined' ? a.assignment.due_at : false;
                break;
            case 'quizzes':
                assignmentId = a.assignment_id;
                dueAt = a.due_at;
                break;
        }
        valid =
            published && dueAt && assignmentId && extra ? assignmentId : false;
    }
    return valid;
}

function getSubmissions(assignmentIds) {
    const P = [];
    if (assignmentIds.length) {
        let n = assignmentIds.length;
        let m = Math.ceil(n / 4);
        if (m > 10 || n <= 10) {
            m = 10;
        }
        let a = 0;
        while (a < n) {
            let b = a + m > n ? n : a + m;
            const url =
                  '/api/v1/courses/' +
                  courseId +
                  '/students/submissions' +
                  '?student_ids[]=all&enrollment_state=active' +
                  '&exclude_response_fields[]=attachments&exclude_response_fields[]=discussion_entries' +
                  '&exclude_response_fields[]=preview_url&per_page=40&assignment_ids[]=' +
                  assignmentIds.slice(a, b).join('&assignment_ids[]=');
            P.push(getAPI(url, 'submissions'));
            a = b;
        }
    }
    return Promise.all(P);
}
