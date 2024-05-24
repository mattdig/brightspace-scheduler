let url = window.top.location.href;
let match_standard = url.match(/\/(?:lessons|content)\/(\d+)\/topics\/(\d+)/);
let match_newstudentexperience = url.match(/\/enhancedSequenceViewer\/(\d+)\?url=(?:\S+)activity%2F(\d+)/)

let ORG_UNIT_ID = 0;
let TOPIC_ID = 0;

if (match_standard != null) {
    ORG_UNIT_ID = match_standard[1];
    TOPIC_ID = match_standard[2];
} else if (match_newstudentexperience != null) {
    ORG_UNIT_ID = match_newstudentexperience[1];
    TOPIC_ID = match_newstudentexperience[2];
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