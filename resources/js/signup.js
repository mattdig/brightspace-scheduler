let bs = new Brightspace;
let USER;
let MY_TIME = false;

$(document).ready(function() {
    init();
});

async function init() {
    USER = await bs.get('/d2l/api/lp/1.42/users/whoami');

    let groups = await getGroupsInCategory();

    availableGroups = await displayGroupsInCategory(groups);

    if(MY_TIME !== false){
        $('#my_selection__content').html('<p>You have selected ' + MY_TIME.Name + '.</p>' + '<p><button class="btn btn-secondary btn-sm" id="cancel-selection">Cancel my selection</button></p>');
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
    return groups;
}

async function displayGroupsInCategory(groups){

    if(groups.length == 0){
        return false;
    }

    let availableGroups = 0;

    let html = '<tr><th>Date & Time</th><th>&nbsp;</th></tr>';

    $('#existing_timeslots__table').html(html);

    groups.forEach(group => {
        
        if(group.student.length === 0){

            availableGroups++;

            html = '<tr class="timeslot" id="timeslot_' + timeSlot.groupId + '">';
            html += '<td class="timeslot_datetime">' + timeSlot.name + '</td>';
            html += '<td class="timeslot_actions">';
            html += '<button class="btn btn-secondary btn-sm select-timeslot" data-id="' + timeSlot.groupId + '">Select this time</button> ';
            html += '</td>';
            html += '</tr>';

            $('#existing_timeslots__table').append(html);
            $('#existing_timeslots__table #timeslot_' + timeSlot.groupId).find('.select-timeslot').on('click', function(){selectTimeSlot(timeSlot)});
        } else if (group.student[0] == USER.Identifier){
            MY_TIME = group;
        }
    });
    
    $('#existing_timeslots').show();
    
    return availableGroups;

}