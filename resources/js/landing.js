let url = window.top.location.href;
let match = url.match(/\/content\/(\d+)\/viewContent\/(\d+)\//);
let ORG_UNIT_ID = match[1];
let TOPIC_ID = match[2];

const bs = new Brightspace(ORG_UNIT_ID);

async function isInstructor(){
    let myEnrollment = await bs.get('/d2l/api/lp/(version)/enrollments/myenrollments/(orgUnitId)/access');
    let isInstructor = myEnrollment.Access.LISRoles.some(element => {
        let isLeanrer = (element.indexOf('Learner') > -1 || element.indexOf('Student') > -1);
        return !isLeanrer;
    });
    return isInstructor;
}

async function redirect(){
    let config = JSON.parse(atob(CONFIG));
    config.t = TOPIC_ID;

    let redirect = '/d2l/lp/navbars/' + ORG_UNIT_ID + '/customlinks/external/' + ((await isInstructor()) ? adminLinkId : signupLinkId) + '?cfg=' + encodeURIComponent(JSON.stringify(config));
    window.top.location.replace(redirect);
}

window.onload = function(event) {
    redirect();
};