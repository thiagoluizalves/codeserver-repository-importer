'use strict';

/**
* This script can be used to lazy load the historical commits of a branch to another in order to onboard them to scm-loader
*
* Usage example: node codeserver-repository-loader.js --repo=my-repo --owner=trilogy-group
* --code-cache-api: (Optional parameter, if missing dev environment URL will be used)
*   The url from where the historical commits will be load.
*   (e.g --code-cache-api=https://codeserver-codecache-dev.devfactory.com)
* --branch-origin: (Optional default master, the branch where the commits come from.
*   (e.g --branch-origin=master)
* --branch-target: The branch where the commits will be merged.
*   (e.g --branch-target=feature1)
* --owner: The owner or organization of the repository.
*   (e.g --owner=trilogy-group)
* --repo: The name of the repository.
*   (e.g --repo=my-githutb-repo)
* --repoDir: The local path for git repository.
*   (e.g --repo-dir=/home/repo/path)
*/

require('console-stamp')(console, { pattern: 'yyyy-mm-dd HH:MM:ss.l' });
const request = require('request');
const args = require('yargs').argv;
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const codeCacheAPI = args['code-cache-api'] || 'https://codeserver-framework-dev.devfactory.com';
const branchFrom = args['branch-origin'] || 'master';
const branchTo = args['branch-target'];
const owner = args['owner'];
const repo = args['repo'];
const repoDir = args['repo-dir'];

//How many commits will be processed at a time
const BULK_SIZE = 50;
const MAX_BUFFER = 1024 * 1024 * 2; // Defined to 2MB
const INTERVAL = 1000 * 60 * 10; // Set to 10min

if (!validateParameters()) {
    return;
}

onboardCommits();

async function onboardCommits() {

    await checkoutToBranch();

    let totalOfCommitsToOnboard = await getTotalOfCommitsToOnboard();

    if (totalOfCommitsToOnboard === 0) {
        console.log('There are no commits to onboard');
        return;
    }

    console.log(`Total of Commits to onboard: ${totalOfCommitsToOnboard}`);

    let commits = await loadCommitsToOnboard();

    for (let i = BULK_SIZE; i < commits.length; i = i + BULK_SIZE) {
        let commitId = (BULK_SIZE + i > commits.length)  ? commits[commits.length] : commits[i];
        await processCommit(commitId);
        await sleep(INTERVAL);
    }
}

async function processCommit(commitId) {
    await mergeToCommit(commitId);
    await push();
    updateCodeCache();
}

async function getTotalOfCommitsToOnboard() {
  const { stdout, stderr } = await exec(`git -C '${repoDir}' rev-list --count ${branchTo}..${branchFrom}`);
  if (stderr) {
    throw new Error(stderr); 
  }
  return stdout;
}

async function checkoutToBranch() {
    console.log(`Checking out to branch ${branchTo}`);
    await exec(`git -C '${repoDir}' merge --abort`);
    const { stdout, stderr } = await exec(`git -C '${repoDir}' checkout ${branchTo}`);
    if (stderr) {
        console.error(stderr);
    } else {
        console.log(`Checked out to branch ${branchTo}`);
    }
}

async function loadCommitsToOnboard() {
    // Max buffer size is defined to 2MB 
    const { stdout, stderr } = await exec(`git -C '${repoDir}' rev-list --reverse ${branchTo}..${branchFrom}`, { maxBuffer: MAX_BUFFER});
    if (stderr) {
        throw new Error(stderr); 
    }
    let commits = stdout.split('\n');
    commits.pop(); // Get rid of the last element as it is a blank line
    return commits;
}

async function mergeToCommit(commitId) {
    console.log(`Merging ${commitId} to ${branchTo}`);
    // Max buffer size is defined to 2MB 
    const { stdout, stderr } = await exec(`git -C '${repoDir}' merge '${commitId}'`, { maxBuffer: MAX_BUFFER});
    if (stderr) {
        const { stdout, stderr } = await exec(`git -C '${repoDir}' merge --abort`, { maxBuffer: MAX_BUFFER});
        console.error(stderr); 
    }
    console.log(`Commit ${commitId} was merged to ${branchTo} succesfull`);
}

async function push() {
    console.log(`Pushing ${branchTo} to origin`);
    // Max buffer size is defined to 2MB 
    const { stdout, stderr } = await exec(`git -C '${repoDir}' push origin ${branchTo}`, { maxBuffer: MAX_BUFFER});
    if (stderr) {
        console.error(stderr);
    }
    console.log(stdout);
}

function updateCodeCache() {
    const url = `${codeCacheAPI}/api/v2/repositories/cache?dfScmUrl=https://github.com/${owner}/${repo}.git?branch=${branchTo}`;
    console.log(`Updating codecache in ${url}`);
    request.post(url, (error, response) => {
        if (error) {
            console.error(`Erro on update code-cache ${error}`);
        } 
        console.log(`Code Cache was updated with success`);
    });
}

function sleep(ms) {
    console.log(`Waiting ${ms} to resume execution`);
    return new Promise(resolve => setTimeout(resolve, ms));
}

function validateParameters() {
    if (!codeCacheAPI) {
        console.log('Missing parameter --code-cache-api');
        console.log('The URL that will be used to update the cache, default value is dev env');
        console.log('(e.g --code-cache-api=https://codeserver-framework-dev.devfactory.com)');
        return false;
    }
    if (!branchTo) {
        console.log('Missing parameter --branch-target');
        console.log('The name of the branch to merge and push commits');
        console.log('Usage example: node codeserver-repository-loader.js --branch-target=feature1');
        return false;
    }
    if (!owner) {
        console.log('Missing parameter --owner');
        console.log('The repository owner or organization');
        console.log('Usage example: node codeserver-repository-loader.js --owner=trilogy-group');
        return false;
    }    
    if (!repo) {
        console.log('Missing parameter --repo');
        console.log('The repository name');
        console.log('Usage example: node codeserver-repository-loader.js --repo=my-repository-name');
        return false;
    }
    if (!repoDir) {
        console.log('Missing parameter --repo-dir');
        console.log('The local path of repository');
        console.log('Usage example: node codeserver-repository-loader.js --repo-dir=/home/repo/path');
        return false;
    }    
    return true;
}

