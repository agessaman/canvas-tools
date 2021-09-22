# Fix Missing Assignments
<img src="./FixMissingAssignment-Menu.png?raw=true" align="right" alt="image of Fix Missing Assignments menu on Assignments page"/>This is a user script that adds an item to the overflow (additional action) menu on individual assignment pages and the Assignments page. Selecting the Fix Missing Assignments option removes the missing labels from assignments that have a score but which have no submission attached.

## Quick Install
1. Install and enable the [Tampermonkey](http://tampermonkey.net/) browser extension
2. Install the [FixMissingAssignments.user.js](https://github.com/agessaman/canvas-tools/raw/main/fix-missing/FixMissingAssignments.user.js) file

This script should be installed with TamperMonkey. It has only been tested in Chrome on Mac and Windows.

## About
Teachers in a hybrid environment tend to collect assignments online as well as on paper. Canvas doesn't handle this well, because if Online Submissions are enabled, it expects all submissions to come in online--and thus flags any assignment without a submission as missing. This leads to poor communication from teachers to parents/students, who often look at the missing flag before looking at the score column.

To resolve this, this script removes the missing flag from assignments if they meet certain criteria. The default settings are:
1. Remove the missing flag if the assignment has a score greater than 0
2. Retain the missing flag for assignment with null scores (a dash in the gradebook)
3. Retain the late flag for all assignments

There are options described below to change these behaviors.

This script runs on the Assignments page which lists all assignments in a course, as well as individual assignment pages. It adds an additional option to the "three-dot" overflow menu on those pages. When run on the Assignments page, it affects all assignments in the course. When run on an individual assignment page, it affects only that specific assignment.

## Customization
This script will automatically run on any Canvas instance hosted at ``*.instructure.com``. If you have a custom domain, then you will need to modify the ``// match`` line to refer to your site.

There are additional options in the file to change its behavior under ``const config``:

``missing: true`` sets the default behavior for missing assignments. true = remove missing flags, false = leave missing flags unchanged

``null_missing: false`` decides whether null (no score) assignments should be treated as missing. true = retain missing flags, false = remove missing flags

``zero_missing: true`` decides whether zeros should be treated as missing. true = retain missing flags, false = remove missing flags

``late: false`` sets the default behavior for assignments that are marked as late. true = remove late flags, false = leave late flags unchanged

``reset: false`` overrides other options and returns assignments to their default missing or late status

``debug: false`` logs potentially useful information about api throttling and logic decisions


## References

This is built on the [no-labels code](https://github.com/jamesjonesmath/canvancement/blob/master/grades/no-labels/no-labels.js) from [James Jones' Canvancements](https://github.com/jamesjonesmath/canvancement/) to remove missing and late labels from the Canvas gradebook.

This user script builds on the feature request from the Canvas User Community entitled [Removing Missing and Late Labels](https://community.canvaslms.com/t5/Developers-Group/Removing-Missing-and-Late-Labels/bc-p/438733#M964).
