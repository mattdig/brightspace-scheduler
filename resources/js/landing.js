let url = window.top.location.href;
let match_standard = url.match(/\/(?:lessons|content)\/(\d+)\/(?:topics|viewContent)\/(\d+)/);
let match_newstudentexperience = url.match(/\/enhancedSequenceViewer\/(\d+)\?url=(?:\S+)activity%2F(\d+)/)
let match_newtab_window = url.match(/[?&]ou=(\d+)/);

let ORG_UNIT_ID = 0;
let TOPIC_ID = 0;

if (match_standard !== null) {
    ORG_UNIT_ID = match_standard[1];
    TOPIC_ID = match_standard[2];
} else if (match_newstudentexperience !== null) {
    ORG_UNIT_ID = match_newstudentexperience[1];
    TOPIC_ID = match_newstudentexperience[2];
} else if (match_newtab_window !== null) {
    let p = document.getElementsByTagName('p')[0];
    p.innerHTML = 'This page cannot run in a seperate tab. Please close this tab and use the default view.';
} else {
    let p = document.getElementsByTagName('p')[0];
    p.innerHTML = 'Something went wrong while loading this page. Please use your browser\'s Back button, or close this tab.';
}

const bs = new Brightspace(ORG_UNIT_ID);

async function isStudent(){
    let myEnrollment = await bs.get('/d2l/api/lp/(version)/enrollments/myenrollments/(orgUnitId)/access');
    for(LISRole of myEnrollment.Access.LISRoles){
        for(role of IMS_STUDENT_ROLES){
            if(LISRole.indexOf(role) > -1){
                return true;
            }
        }
    }
    return false;
}

async function redirect(){
    if(ORG_UNIT_ID === 0 || TOPIC_ID === 0){
        return;
    }

    let student = isStudent();
    let config = {};
    if(typeof(CONFIG) !== 'undefined'){
        config = JSON.parse(CONFIG);
    } else {
        config.gc = GROUP_CATEGORY_ID;
    }
    
    config.t = TOPIC_ID;
    config = btoa(JSON.stringify(config));

    student = await student;

    let redirect = '/d2l/lp/navbars/' + ORG_UNIT_ID + '/customlinks/external/' + ((student) ? signupLinkId : adminLinkId) + '?cfg=' + config;
    
    if(student){
        window.location.replace(redirect);
    } else {
        window.top.location.replace(redirect);
    }
}

window.onload = function(event) {
    redirect();
};