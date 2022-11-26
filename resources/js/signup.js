let bs = new Brightspace(ORG_UNIT_ID);
let USER;
let MY_TIME = false;

$(document).ready(function() {
    init();
});

async function init() {
    USER = await bs.get('/d2l/api/lp/(version)/users/whoami');
    console.log(GROUP_CATEGORY_ID);
    let groupCategory = await bs.get('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID);
    console.log(groupCategory);
    $('#description').val(groupCategory.Description.Text);
    
    let groups = await getGroupsInCategory();

    availableGroups = await displayGroupsInCategory(groups);

    if(MY_TIME !== false){
        $('#my_selection__content').html('<p>You have selected ' + MY_TIME.name + '.</p>' + '<p><button class="btn btn-secondary btn-sm cancel-timeslot" id="cancel-selection">Cancel my selection</button></p>');
        $('#cancel-selection').on('click', function(){cancelMySelection()});
        $('#my_selection').show();
    }

    if(availableGroups == 0){
        $('#existing_timeslots__heading').html('No are additional time slots are available');
    } else if(MY_TIME !== false){
        $('#existing_timeslots__heading').html('Other available time slots');
    } else {
        $('#existing_timeslots__heading').html('Available time slots');
    }
}

async function getGroupsInCategory(){
    let groups = await bs.get('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/');
    console.log(groups);
    return groups;
}

async function displayGroupsInCategory(groups){

    if(groups.length == 0){
        return false;
    }

    let availableGroups = 0;
    let html = '<tr><th>Date & Time</th><th class="student_timeslot_actions">&nbsp;</th></tr>';

    $('#existing_timeslots__table').html(html);

    groups.forEach(group => {
        
        if(group.Enrollments.length === 0){

            availableGroups++;

            html = '<tr class="timeslot" id="timeslot_' + group.GroupId + '">';
            html += '<td class="timeslot_datetime">' + group.Name + '</td>';
            html += '<td class="timeslot_actions student_timeslot_actions">';
            html += '<button class="btn btn-secondary btn-sm select-timeslot" data-id="' + group.GroupId + '">Select this time</button> ';
            html += '</td>';
            html += '</tr>';

            $('#existing_timeslots__table').append(html);
            $('#timeslot_' + group.GroupId).find('.select-timeslot').on('click', function(){selectTimeSlot(group)});
        } else if (group.Enrollments[0] == USER.Identifier){
            MY_TIME = {
                name: group.Name,
                groupId: group.GroupId,
                student: group.Enrollments[0]
            }
        }
    });
    
    if(MY_TIME === false){
        $('.student_timeslot_actions').show();
    }
    $('#existing_timeslots').show();
    
    return availableGroups;

}

async function cancelMySelection(){
    if(MY_TIME === false || !confirm('Are you sure you cancel this registration?\n\nYou will lose this time slot and you will need to select a new one.')){
        return false;
    }

    $('#cancel-selection').remove();
    let result = await unenrollFromGroup(MY_TIME.groupId, MY_TIME.student);
    MY_TIME = false;
    window.location.reload();
}

async function selectTimeSlot(group){
    if(MY_TIME !== false || !confirm('Are you sure you want to select:\n\n' + group.Name)){
        return false;
    }

    let data = {
        "d2l_rf": "IsGroupFull",
        "params": "{\"param1\":" + group.GroupId + "}",
        "d2l_action": "rpc"
    };
    let isFull = await bs.submit('/d2l/lms/group/user_available_group_list.d2lfile?ou=7194&d2l_rh=rpc&d2l_rt=call',data);
    
    if(isFull.Result == 'true'){
        alert('This time slot is full. Please select another time slot.');
        $('#timeslot_' + group.GroupId).find('.select-timeslot').remove();
        return false;
    }

    result = await enrollInGroup(group.GroupId, USER.Identifier);
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
    return bs.submit('/d2l/lms/group/user_available_group_list.d2lfile?ou=7194&d2l_rh=rpc&d2l_rt=call', data);
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
