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
        $('#my_selection__content').html('<p>You have selected ' + MY_TIME.Name + '.</p>' + '<p><button class="btn btn-secondary btn-sm cancel-timeslot" id="cancel-selection">Cancel my selection</button></p>');
        $('#my_selection__content').find('#cancel-selection').on('click', function(){cancelSelection(MY_TIME)});
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

    let html = '<tr><th>Date & Time</th>' + (MY_TIME === false ? '<th class="student_timeslot_actions>&nbsp;</th>' : '') + '</tr>';

    $('#existing_timeslots__table').html(html);

    groups.forEach(group => {
        
        if(group.Enrollments.length === 0){

            availableGroups++;

            html = '<tr class="timeslot" id="timeslot_' + group.GroupId + '">';
            html += '<td class="timeslot_datetime">' + group.Name + '</td>';
            if(MY_TIME === false){
                html += '<td class="timeslot_actions student_timeslot_actions">';
                html += '<button class="btn btn-secondary btn-sm select-timeslot" data-id="' + group.GroupId + '">Select this time</button> ';
                html += '</td>';
            }
            html += '</tr>';

            $('#existing_timeslots__table').append(html);
            $('#existing_timeslots__table #timeslot_' + group.GroupId).find('.select-timeslot').on('click', function(){selectTimeSlot(group)});
        } else if (group.Enrollments[0] == USER.Identifier){
            MY_TIME = {
                name: group.Name,
                groupId: group.GroupId,
                student: group.Enrollments[0]
            }
        }
    });
    
    $('#existing_timeslots').show();
    
    return availableGroups;

}

function cancelTimeSlot(timeSlot){
    if(MY_TIME === false || !confirm('Are you sure you cancel this registration?\n\nYou will lose this time slot and you will need to select a new one.')){
        return false;
    }

    MY_TIME = false;
    $('#timeslot_' + timeSlot + ' .timeslot_student').html('&nbsp;-&nbsp;');
    $('#timeslot_' + groupId).find('.cancel-timeslot').remove();
    unenrolFromGroup(groupId, student);
    window.location.reload();
}

async function selectTimeSlot(group){
    if(MY_TIME !== false || !confirm('Are you sure you want to select:\n\n' + group.Name)){
        return false;
    }
    await enrollInGroup(group.GroupId, group.Enrollments[0]);
    alert('You have successfully selected ' + group.Name + '.');
    window.location.reload();
}

async function enrollInGroup(groupId, student){
    let data = {
        "UserId": student
    };
    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + groupId + '/enrollments/', data);
}

function unenrolFromGroup(groupId, student){
    return bs.delete('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + groupId + '/enrollments/' + student);
}
