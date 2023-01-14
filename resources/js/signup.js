let TITLE;
let MY_TIME = false;
let USER;
let MAX_STUDENTS = 1;
let CLASSLIST;

$(function(){init();});

async function init() {

    CLASSLIST = getClassList('bas');
    USER = whoAmI();

    let groupCategory = await getGroupCategory(GROUP_CATEGORY_ID);
    TITLE = groupCategory.Name;
    if(groupCategory.Description.Text != ''){
        $('#schedule_description').html(groupCategory.Description.Text)
        $('#schedule_description').show();
    }
    MAX_STUDENTS = groupCategory.MaxUsersPerGroup;
    
    let groups = await getGroupsInCategory();
    let availableGroups = await displayGroupsInCategory(groups);

    if(MY_TIME !== false){
        $('#my_selection__content').html('<h3>' + MY_TIME.name + '</h3>' + '<p><button class="btn btn-secondary btn-sm cancel-timeslot" id="cancel-selection">Cancel my selection</button></p>');
        $('#cancel-selection').on('click', function(){cancelMySelection()});
        $('#my_selection').show();
    }
}

async function displayGroupsInCategory(groups){
    
    let availableGroups = 0;
    let html = '<tr>' + (MAX_STUDENTS > 1 ? '<th>Enrollment</th>' : '') + '<th>Date & Time</th><th class="student_timeslot_actions">Actions</th></tr>';

    $('#existing_timeslots__table').html(html);

    const results = await Promise.all([CLASSLIST, USER]);
    CLASSLIST = results[0];
    USER = results[1];

    for(let group of groups){
        
        if(group.Enrollments.length < MAX_STUDENTS && !group.Enrollments.includes(USER.Identifier)){

            availableGroups++;

            html = '<tr class="timeslot" id="timeslot_' + group.GroupId + '">';
            if(MAX_STUDENTS > 1){
                html += '<td class="timeslot_datetime">' + group.Enrollments.length + '/' + MAX_STUDENTS + ' students';
                if(group.Enrollments.length > 0){
                    html += '<br><small>';
                    for(let student of group.Enrollments){
                        html += CLASSLIST[student].DisplayName + '<br>';
                    }
                    html += '</small>';
                }
                html += '</td>';
            }
            html += '<td class="timeslot_datetime">' + group.Name + '</td>';
            html += '<td class="timeslot_actions student_timeslot_actions">';
            html += '<button class="btn btn-secondary btn-sm select-timeslot" data-id="' + group.GroupId + '">Select this time</button>';
            html += '</td>';
            html += '</tr>';

            $('#existing_timeslots__table').append(html);
            $('#timeslot_' + group.GroupId).find('.select-timeslot').on('click', function(){selectTimeSlot(group)});
        } else if (group.Enrollments.includes(USER.Identifier)){
            MY_TIME = {
                name: group.Name,
                groupId: group.GroupId,
                student: USER.Identifier
            }
        }
    }
    
    if(MY_TIME === false){
        $('.student_timeslot_actions').show();
    } else {
        $('.student_timeslot_actions').remove();
    }
    
    if(availableGroups == 0){
        $('#existing_timeslots__heading').html('No additional time slots are available');
        $('#existing_timeslots__table').remove();
    } else if(MY_TIME !== false){
        $('#existing_timeslots__heading').html('Other available time slots');
    } else {
        $('#existing_timeslots__heading').html('Available time slots');
    }

    $('#existing_timeslots').show();

    return availableGroups;

}

async function cancelMySelection(){
    if(MY_TIME === false || !confirm('Are you sure you cancel this registration?\n\nYou will lose this time slot and you will need to select a new one.')){
        return false;
    }

    $('#cancel-selection').remove();
    await unenrollFromGroup(MY_TIME.groupId);
    MY_TIME = false;
    window.location.reload();
}

async function selectTimeSlot(group){

    let classList = getClassList();

    if(MY_TIME !== false || !confirm('Are you sure you want to select:\n\n' + group.Name)){
        return false;
    }

    let data = {
        "d2l_rf": "IsGroupFull",
        "params": "{\"param1\":" + group.GroupId + "}",
        "d2l_action": "rpc"
    };
    let isFull = await bs.submit('/d2l/lms/group/user_available_group_list.d2lfile?ou=(orgUnitId)&d2l_rh=rpc&d2l_rt=call',data);
    
    if(isFull.Result === true){
        alert('This time slot is full. Please select another time slot.\n\nReload the page to see the updated list of available time slots.');
        $('#timeslot_' + group.GroupId).remove();
        return false;
    }

    let enroll = enrollInGroup(group.GroupId);

    let host = window.location.host;

    let calendarSubscription = await bs.get('/d2l/le/calendar/(orgUnitId)/subscribe/subscribeDialogLaunch?subscriptionOptionId=-1');
    let feedToken = calendarSubscription.match(/feed\.ics\?token\=([a-zA-Z0-9]+)/)[1];
    let feedUrl = 'webcal://' + host + '/d2l/le/calendar/feed/user/feed.ics?token=' + feedToken;
    let calendarUrl = 'https://' + host + '/d2l/le/calendar/' + ORG_UNIT_ID;
    let topicUrl = window.top.location.href.split('?')[0];

    let pluginPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));

    subject = 'Brightspace Scheduling: Your time slot is confirmed';

    result = await fetch(pluginPath + '/resources/html/emailstudent.tpl');
    body = await result.text();

    body = body.replace(/\(scheduleTitle\)/g, TITLE);
    body = body.replace(/\(timeSlot\)/g, group.Name);
    body = body.replace(/\(feedUrl\)/g, feedUrl);
    body = body.replace(/\(topicUrl\)/g, topicUrl);
    body = body.replace(/\(calendarUrl\)/g, calendarUrl);

    classList = await classList;
    let studentEmail = classList[USER.Identifier].Email;

    let email = sendEmail(studentEmail, subject, body);

    await Promise.all([enroll, email]);

    alert('You have successfully selected ' + group.Name + '.');
    window.location.reload();
}

function enrollInGroup(groupId){
    // api doesn't let learners enroll themselves, form must be used instead
    let data = {
        "d2l_rf": "EnrollUser",
        "params": "{\"param1\":" + groupId + "}",
        "d2l_action": "rpc"
    };
    return bs.submit('/d2l/lms/group/user_available_group_list.d2lfile?ou=(orgUnitId)&d2l_rh=rpc&d2l_rt=call', data);
}

function unenrollFromGroup(groupId){
    // api doesn't let learners unenroll themselves, form must be used instead
    let data = {
        "d2l_rf": "UnenrollUser",
        "params": "{\"param1\":" + groupId + "}",
        "d2l_action": "rpc"
    };
    return bs.submit('/d2l/lms/group/user_group_list.d2lfile?ou=(orgUnitId)&d2l_rh=rpc&d2l_rt=call', data);
}
