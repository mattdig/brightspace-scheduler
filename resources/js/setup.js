let bs = new Brightspace(ORG_UNIT_ID);

let PLUGIN_PATH;

let TOPIC_ID;

let HOST_NAME;

let SUBMITTING = false;

let orgUnitInfo;

let targetModuleId;

let timeZone;

let globalLatestTime;

let timeBlocks = [];

let existingTimeSlots = [];
let newTimeSlots = [];

let totalTimeSlots = 0;

$(function() {
    setup();
});

async function setup(){

    HOST_NAME = window.location.hostname;

    PLUGIN_PATH = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));

    let myEnrollment = await bs.get('/d2l/api/lp/(version)/enrollments/myenrollments/(orgUnitId)/access');
    let isInstructor = myEnrollment.Access.LISRoles.some(element => {
        let isLeanrer = (element.indexOf('Learner') > -1 || element.indexOf('Student') > -1);
        return !isLeanrer;
    });

    if(!isInstructor){
        alert("Yer a wizard, Harry! But you're not an instructor, so you can't use this tool.");
        window.location.href = PLUGIN_PATH + '/signup.html?ou=' + ORG_UNIT_ID + '&gc=' + GROUP_CATEGORY_ID;
        return false;
    }

    if(ORG_UNIT_ID !== null){
        let orgInfo = await bs.get('/d2l/api/lp/(version)/organization/info');

        timeZone = orgInfo.TimeZone;
        
        orgUnitInfo = await bs.get('/d2l/api/lp/(version)/courses/(orgUnitId)');
        
        let modules = await bs.get("/d2l/api/le/(version)/(orgUnitId)/content/root/");

        targetModuleId = modules[0].Id;
    }
    
    moment.tz.setDefault(timeZone);

    //updateGlobalLatestTime(moment());

    // $('#timeslot_number').on('change', function(){
    //     updateTotalTimeSlots();
    // });

    // not supported by api
    //generateTimeOptions($('#deadline_time'));

    if(MODE == 'edit'){

        let url = window.parent.location.href;
        let match = url.match(/\/viewContent\/(\d+)\//);
        TOPIC_ID = match[1];
        
        let topic = await bs.get('/d2l/api/le/(version)/(orgUnitId)/content/topics/' + TOPIC_ID);
        console.log(topic);

        $('#form_title').html('Edit Signup Schedule');

        // deadline not supported by api
        // TODO: switch to fetching the HTML page for the form and parsing it
        let groupCategory = await bs.get('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID);
        $('#title').val(groupCategory.Name);

        $('#description').val(groupCategory.Description.Text);

        // not supported by api
        // $('#deadline_date').val(moment.utc(groupCategory.SelfEnrollmentExpiryDate, 'YYYY-MM-DDTHH:mm:ss.fffZ').tz(timeZone).format('YYYY-MM-DD'));
        // $('#deadline_time').val(moment.utc(groupCategory.SelfEnrollmentExpiryDate, 'YYYY-MM-DDTHH:mm:ss.fffZ').tz(timeZone).format('HH:mm'));
        
        await getExistingTimeSlots();
        let calendarEvent = await bs.get('/d2l/api/le/(version)/(orgUnitId)/calendar/event/' + existingTimeSlots[0].eventId);
        $('#event_title').val(calendarEvent.Title);
        
        await displayExistingTimeSlots();

        $('#add_new_timeblocks').show();

        $('#edit_schedule').show();

    } else {
        $('#form_title').html('Create New Signup Schedule');
        $('#edit_timeblocks').show();
        $('#signup_schedule__form').show();
    }

    let firstDateTime = $('.datetime__div').first();
    initializeDatetime(firstDateTime);
    firstDateTime.find('.btn-remove').on('click', removeDatetime);

    // not supported by api
    // $('#deadline_date').datetimepicker({
    //     format: 'YYYY-MM-DD',
    //     defaultDate: moment(),
    //     maxDate: moment().clone().add(1, 'years')
    // });

    $('#timeslot_duration').on('change', function(){
        updateTotalTimeSlots();
    });

}

async function updateEventTitle(element){
    if($('#event_title').val() == ''){
        $('#event_title').val(element.value);
    }
}

async function getGroupsInCategory(){
    let groups = await bs.get('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/');
    return groups;
}

async function getExistingTimeSlots(){

    let groups = await getGroupsInCategory();
        
    for(const group of groups){
        
        let data = group.Code.split('_');

        let startTime = moment.utc(data[0], 'YYYYMMDDHHmm').tz(timeZone);
        let endTime = moment.utc(data[1], 'YYYYMMDDHHmm').tz(timeZone);

        let localDateTimeFormat = startTime.format('MMM[&nbsp;]Do[&nbsp;]YYYY, h:mm[&nbsp;]A') + '&nbsp;-&nbsp;' + endTime.format('h:mm[&nbsp;]A');
        
        let timeslot = {
            start: startTime,
            end: endTime,
            name: localDateTimeFormat,
            groupId: group.GroupId,
            eventId: data[2],
            student: (group.Enrollments.length > 0 ? group.Enrollments[0] : false)
        };

        existingTimeSlots.push(timeslot);
    };
}

async function displayExistingTimeSlots(){

    if(existingTimeSlots.length == 0){
        return false;
    }

    let duration = 0;

    let classList = await getClassList();

    let html = '<tr><th>Registration</th><th>Date & Time</th><th>Actions</th></tr>';

    $('#existing_timeslots__table').html(html);

    existingTimeSlots.forEach(timeSlot => {
        
        let student = '&nbsp;-&nbsp;';
        
        if(timeSlot.student !== false){
            student = classList[timeSlot.student].FirstName + ' ' + classList[timeSlot.student].LastName + ' (' + classList[timeSlot.student].OrgDefinedId + ')';
        }

        if(duration == 0){
            duration = timeSlot.end.diff(timeSlot.start, 'minutes');
        }

        html = '<tr class="timeslot" id="timeslot_' + timeSlot.groupId + '">';
        html += '<td class="timeslot_student">' + student + '</td>';
        html += '<td class="timeslot_datetime">' + timeSlot.name + '</td>';
        html += '<td class="timeslot_actions">';
        if(timeSlot.student !== false){
            html += '<button class="btn btn-secondary btn-sm cancel-timeslot" data-id="' + timeSlot.groupId + '">Cancel Registration</button> ';
        }
        html += '<button class="btn btn-red btn-sm delete-timeslot" data-id="' + timeSlot.groupId + '">Delete Time Slot</button></td>';
        html += '</td>';
        html += '</tr>';

        $('#existing_timeslots__table').append(html);
        $('#existing_timeslots__table #timeslot_' + timeSlot.groupId).find('.cancel-timeslot').on('click', function(){cancelTimeSlot(timeSlot)});
        $('#existing_timeslots__table #timeslot_' + timeSlot.groupId).find('.delete-timeslot').on('click', function(){deleteTimeSlot(timeSlot)});
    });
    
    $('#existing_timeslots').show();
    $('#timeslot_duration').val(duration);

    return true;

}

function addDatetime(){
    if($('#edit_timeblocks').is(':visible')){
        let lastDatetime = $('.datetime__div').last();
        let newDateTime = orderDatetimeElems(lastDatetime.clone(), $('.datetime__div').length + 1);
        newDateTime.find('.btn-remove').on('click', removeDatetime);
        newDateTime.insertAfter(lastDatetime);
        initializeDatetime($('.datetime__div').last());   // initialize the new datetime
    } else {
        $('#edit_timeblocks').show();
        validateTimeFields();
    }
}

function removeDatetime(element){
    if($('.datetime__div').length > 1){
        let target = $(element.target);
        $('#datetime_' + target.data('counter')).remove();
        orderDatetimeElems();
        validateTimeFields();
    } else if($('.datetime__div').length == 1 && MODE == 'edit'){
        $('#edit_timeblocks').hide();
        $('#add_new_timeblocks').show();
    }
}

function orderDatetimeElems(element = null, counter = null){

    if(element == null){
        element = $('.datetime__div');
    }

    element.each(function(index, elem){

        if(counter != null){
            index = counter;
        } else {
            index = index + 1;
        }

        elem = $(elem);

        elem.attr('id', 'datetime_' + index);
        elem.find('h3').find('span').text('Date & Time ' + index);
        elem.find('h3').find('button').data('counter', index);
        elem.find('label.date_label').attr('for', 'date_' + index);
        elem.find('label.starttime_label').attr('for', 'starttime_' + index);
        elem.find('label.endtime_label').attr('for', 'endtime_' + index);
        
        elem.find('input.date_input').attr('id', 'date_' + index).attr('name', 'date_' + index);
        elem.find('select.starttime_input').attr('id', 'starttime_' + index).attr('name', 'starttime_' + index);
        elem.find('select.endtime_input').attr('id', 'endtime_' + index).attr('name', 'endtime_' + index);
    });

    return element;
}

function initializeDatetime(datetimeElem){

    //let latestTime = globalLatestTime.clone();

    let latestTime = moment();
    let initializeTimes = true;

    if($('.datetime__div').length > 1){
        initializeTimes = false;
        let lastDatetime = $('.datetime__div').last().prev();
        latestTime = moment(lastDatetime.find('.date_input').val() + ' ' + lastDatetime.find('.starttime_input').val(), 'YYYY-MM-DD HH:mm').add(1, 'days');
    }

    let interval = 30;

    let remainder = latestTime.minutes() % interval;
    
    if(remainder < interval / 2){
        latestTime.subtract(remainder, 'minutes');
    } else {latestTime.add(interval - remainder, 'minutes');}
    
    $(datetimeElem).find('.date_input').val('').datetimepicker({
        format: 'YYYY-MM-DD',
        defaultDate: moment(latestTime),
        minDate: moment().subtract(1, 'days'),
        maxDate: moment().add(1, 'years')
    }).on('dp.hide', function(e){
        validateTimeFields(false);
    });

    
    

    if(initializeTimes){
        latestTime = momentFromTime(latestTime.format('HH:mm'));
    
        let minTime = momentFromTime('00:00');
        let maxTime = latestTime.clone().add(1, 'hours');

        generateTimeOptions($(datetimeElem).find('.starttime_input'), latestTime, minTime, maxTime, interval);

        minTime = latestTime.clone().add(30, 'minutes');
        maxTime = momentFromTime('23:59');

        generateTimeOptions($(datetimeElem).find('.endtime_input'), latestTime.clone().add(1, 'hours'), minTime, maxTime, interval);
    }

    $(datetimeElem).find('.starttime_input').on('change', function(){
        let object = $(datetimeElem).find('.endtime_input')
        let time = momentFromTime(object.val());
        let startTime = momentFromTime($(this).val()).add(interval, 'minutes');
        let endTime = momentFromTime('23:59');
        generateTimeOptions(object, time, startTime, endTime, interval);
        validateTimeFields(false);
    });

    $(datetimeElem).find('.endtime_input').on('change', function(){
        let object = $(datetimeElem).find('.starttime_input')
        let time = momentFromTime(object.val());
        let startTime = momentFromTime('00:00');
        let endTime = momentFromTime($(this).val());
        generateTimeOptions(object, time, startTime, endTime, interval);
        validateTimeFields(false);
    });

    // minTime = latestTime.clone().add(30, 'minutes');
    // maxTime = moment([0, 0, 0, 23, 30, 0, 0]);

    
    validateTimeFields(false);

}

function generateTimeOptions(object, defaultTime = false, startTime = 0, endTime = 0, interval = 60){

    let options = [];

    if(!defaultTime){
        defaultTime = momentFromTime('12:00');
    }

    if(startTime === 0){
        startTime = momentFromTime('00:00');
    }

    if(endTime === 0){
        endTime = momentFromTime('23:59');
    }

    if(defaultTime.isBefore(startTime) || defaultTime.isBefore(startTime)){
        defaultTime = startTime.clone();
    }

    for(let i = 0; i < (24 * (60 / interval)); i++){
        let time = startTime.clone().add(i * interval, 'minutes');

        if(time.isBefore(endTime)){
            let selected = time.isSame(defaultTime) ? 'selected="selected"' : '';
            
            options.push('<option value="' + time.format('HH:mm') + '" ' + selected + '>' + time.format('h:mm A') + '</option>');
        }
    }

    $(object).empty().append(options.join(''));
    
}

function selectTab(obj){
    $('.tabs').find('li').removeClass('active');
    $(obj).parent().addClass('active');
    $('.tabs').find('div').removeClass('active');
    $('.tabs').find($(obj).attr('href')).addClass('active');

    updateTotalTimeSlots();
}

function updateTotalTimeSlots(){
    totalTimeSlots = 0;
    newTimeSlots = [];
    let timeSlotDuration = 0;
    let totalTime = 0;

    // gave up total number of timeslots, kept the code just in case
    if(true){//($('#timeslot_unit_tabs').find('li.active').data('unit') == 'duration'){

        timeSlotDuration = parseInt($('#timeslot_duration').val());

        timeBlocks.forEach(block => {
            totalTime += block.end.diff(block.start, 'minutes');

            if(timeSlotDuration >= 5){
                let timeSlotsInBlock = parseInt(Math.floor(block.end.diff(block.start, 'minutes') / timeSlotDuration));

                for(i = 0; i < timeSlotsInBlock; i++){
                    let newTimeSlot = {
                        groupId: null,
                        eventId: null,
                        start: block.start.clone().add(i * timeSlotDuration, 'minutes'),
                        end: block.start.clone().add((i + 1) * timeSlotDuration, 'minutes'),
                    };
                    newTimeSlots.push(newTimeSlot);
                }

                totalTimeSlots += timeSlotsInBlock;
            }

        });

    // total number was too hard to calculate, so just use the number of time slots in the first block
    } else {
        
        totalTimeSlots = parseInt($('#timeslot_number').val());

        let smallestTimeBlock = 0;
        let totalSmallestUnits = 0;

        timeBlocks.forEach(block => {
            let blockTime = block.end.diff(block.start, 'minutes');
            console.log(blockTime);
            if(smallestTimeBlock == 0 || blockTime < smallestTimeBlock){
                smallestTimeBlock = blockTime;
            }
        });

        console.log(smallestTimeBlock);

        timeBlocks.forEach(block => {
            let unitsInBlock = block.end.diff(block.start, 'minutes') / smallestTimeBlock;
            block.blockUnits = unitsInBlock;
            totalSmallestUnits += unitsInBlock;
        });

        console.log(totalSmallestUnits);

        let smallestBlockToTotal = totalSmallestUnits / totalTimeSlots;
        timeSlotDuration = smallestTimeBlock * smallestBlockToTotal;
        if(timeSlotDuration > smallestTimeBlock){
            timeSlotDuration = smallestTimeBlock;
        }

        totalTime = timeSlotDuration * totalTimeSlots;

    }

    if(totalTime > 90){
        //convert to hours with 2 decimal places
        totalTime = parseFloat((totalTime / 60).toFixed(2));
        units = 'hours';
    } else {
        units = 'minutes';
    }

    $('#total_time').text('Total time: ' + totalTime + ' ' + units);

    if(totalTimeSlots > 0){
        $('#total_timeslots').text('This will create ' + totalTimeSlots + ' time slots of ' + timeSlotDuration + ' minutes each.');
        return true;
    } else {
        $('#total_timeslots').text('Please enter a valid time slot duration of at least 5 mintues.');
        return false;
    }

}



function updateGlobalLatestTime(newTime){
    
    let now = moment();

    if(globalLatestTime == null || newTime.isAfter(globalLatestTime)){
        globalLatestTime = newTime.clone();
    }

    if(globalLatestTime.hours() > 22){
        globalLatestTime.add(1, 'days').hours(8).minutes(0);
    }

    if(globalLatestTime.isBefore(now)){
        globalLatestTime = now.clone();
    }
    
}


function validateTimeFields(withErrors){

    globalLatestTime = null;

    let valid = true;
    newTimeSlots = [];
    timeBlocks = [];

    let datetimes = [];
    
    let latestTime = moment();

    //let selectedTab = $('.tab-pane.active').find('label').attr('for');
    //let blockValue = parseInt($('#' + selectedTab).val());

    if($('#edit_timeblocks').is(':visible')){
        $('.datetime__div').each(function(){
            let datetime = {};
            let format = "YYYY-MM-DD HH:mm";
            let date = $(this).find('.date_input').val() + " ";
            datetime.id = $(this).attr('id');
            datetime.start = moment(date + $(this).find('.starttime_input').val(), format);
            datetime.end = moment(date + $(this).find('.endtime_input').val(), format);
            datetimes.push(datetime);
        });
    } else {
        return true;
    }

    datetimes.sort(compareStarttime);

    datetimes.every(function(datetime1, i){
        if(datetime1.start.isAfter(datetime1.end) || datetime1.start.isSame(datetime1.end)){

            if(withErrors){
                errorMessage('Start time must be before end time.', $('#' + datetime1.id).find('select'));
            }
            valid = false;
            return false;
        
        } else {

            let spliceIndexes = [];

            let noOverlapWithBlocks = datetimes.slice(i + 1).every(function(datetime2, j){
                if(datetime1.id != datetime2.id && (
                    datetime1.start.isAfter(datetime2.start) && datetime1.start.isBefore(datetime2.end) || 
                    datetime1.end.isAfter(datetime2.start) && datetime1.end.isBefore(datetime2.end) ||
                    datetime2.start.isAfter(datetime1.start) && datetime2.start.isBefore(datetime1.end) || 
                    datetime2.end.isAfter(datetime1.start) && datetime2.end.isBefore(datetime1.end) ||
                    datetime1.start.isSame(datetime2.start) || datetime1.end.isSame(datetime2.end))){
                    
                    if(withErrors){
                        errorMessage('Datetimes must not overlap.', $('#' + datetime2.id).find(':input'));
                    }
                    valid = false;
                    return false;
                } else {

                    if(datetime1.end.isSame(datetime2.start)){
                        datetime1.end = datetime2.end.clone();
                        spliceIndexes.push(i + j + 1);
                    }

                    return true;
                }
            });

            if(noOverlapWithBlocks == false){
                return false;
            }

            let noOverlapWithSlots = existingTimeSlots.every(function(datetime2, j){
                
                console.log(datetime1.start.format() + ' - ' + datetime1.end.format());
                console.log(datetime2.start.format() + ' - ' + datetime2.end.format());

                if( datetime1.start.isAfter(datetime2.start) && datetime1.start.isBefore(datetime2.end) || 
                    datetime1.end.isAfter(datetime2.start) && datetime1.end.isBefore(datetime2.end) ||
                    datetime2.start.isAfter(datetime1.start) && datetime2.start.isBefore(datetime1.end) || 
                    datetime2.end.isAfter(datetime1.start) && datetime2.end.isBefore(datetime1.end) ||
                    datetime1.start.isSame(datetime2.start) || datetime1.end.isSame(datetime2.end)){
                    
                    if(withErrors){
                        errorMessage('New time ranges must not overlap with existing time slots.', $('#' + datetime1.id).find('.timeblock_datetime_input'));
                    }
                    valid = false;
                    return false;
                } else {

                    if(datetime1.end.isSame(datetime2.start)){
                        datetime1.end = datetime2.end.clone();
                        spliceIndexes.push(i + j + 1);
                    }

                    return true;
                }
            });

            if(noOverlapWithSlots == false){
                return false;
            }
            

            timeBlocks.push(datetime1);

            spliceIndexes.forEach(function(index){
                datetimes.splice(index, 1);
            });
            
            if(datetime1.end.isAfter(latestTime)){
                latestTime = datetime1.end.clone();
            }
            return true;
            
        }
    });

    // if(blockValue == ''){
    //     $('#' + selectedTab).addClass('error');
    //     valid = false;
    //     return false;
    // }

    if(valid){
        if(!updateTotalTimeSlots() && withErrors){
            errorMessage('Please enter a time slot duration of at least 5.', $('#timeslot_duration'));
            valid = false;
        }
    }

    //updateGlobalLatestTime(latestTime);

    return valid;

}

function compareStarttime(a, b){
    if(a.start.isBefore(b.start)){
        return -1;
    } else if(a.start.isAfter(b.start)){
        return 1;
    } else {
        return 0;
    }
}


function validateAllFields(){

    $(':input').removeClass('error');

    let title = $('#title').val();
    
    if(title == ''){
        $('#title').addClass('error');
        return false;
    }

    let event_title = $('#event_title').val();
    
    if(event_title == ''){
        $('#event_title').addClass('error');
        return false;
    }
    
    // not supported by api
    // let deadlineDate = moment($('#deadline_date').val() + ' ' + $('#deadline_time').val(), 'YYYY-MM-DD HH:mm');
    // if(deadlineDate.isBefore(moment())){
    //     errorMessage('Deadline must be after today.', [$('#deadline_date') , $('#deadline_time')]);
    //     return false;
    // }

    let valid = validateTimeFields(true);

    return(valid && newTimeSlots.length > 0);

}

function updateTimeSlots(timeBlock){
    let duration = timeBlock.end - timeBlock.start;
    let slotsPerBlock = Math.floor(duration.asMinutes() / timeBlockSize);
    totalTimeSlots += slotsPerBlock;
    for(i = 0; i < slotsPerBlock; i++){
        let time ={
            'start' : timeBlock.start.add(i * timeBlockSize, 'minutes'),
            'end' : timeBlock.start.add((i + 1) * timeBlockSize, 'minutes')
        }
        timeSlots.push(time);
    }

//     $('#' + timeBlock.id).find('.totalTime').html(totalTime.format('HH:mm'));
//     $('#' + timeBlock.id).find('.totalBlocks').html();
}

async function submitForm(){

    if(!SUBMITTING){

        SUBMITTING = true;

        if(!validateAllFields(true)){
            SUBMITTING = false;
            return false;
        }

        if(true || ORG_UNIT_ID == null){
            errorMessage('All fields are valid, but Org Unit Id is not defined');
            SUBMITTING = false;
            return false;
        }

        let groupCategory;
        let newTopic;

        if(MODE == 'create'){
            groupCategory = await createGroupCategory();

            GROUP_CATEGORY_ID = groupCategory.CategoryId;
            newTopic = await createTopic();
        } else {
            await updateGroupCategory();
            await updateTopic();
        }


        if(GROUP_CATEGORY_ID != null){

            let groupsInCategory;

            if(MODE == 'create'){
                groupsInCategory = await getGroupsInCategory();
            } else {
                for (timeSlot in existingTimeSlots){
                    await updateCalendarEvent(timeSlot);
                }
            }

            console.log(newTimeSlots);
            SUBMITTING = false;
            return false;

            for(const [index,timeSlot] of newTimeSlots.entries()){

                    let group;

                    if(MODE == 'create'){
                        group = groupsInCategory[index];
                    } else {
                        group = await createGroup(timeSlot);
                    }

                    timeSlot.groupId = group.GroupId;
                    
                    let newEvent = await createCalendarEvent(timeSlot);
                    
                    timeSlot.eventId = newEvent.CalendarEventId;
                    
                    await updateGroup(timeSlot);

            };
        }

        errorMessage('Form submitted successfully.',null,function(){
            if(MODE == 'create'){
                window.location.href = '/d2l/le/content/' + ORG_UNIT_ID + '/viewContent/' + newTopic.Id + '/View'; 
            } else {
                window.location.reload();
            }
        });

        setTimeout(function(){
            if(MODE == 'create'){
                window.location.href = '/d2l/le/content/' + ORG_UNIT_ID + '/viewContent/' + newTopic.Id + '/View'; 
            } else {
                window.location.reload();
            }
        }, 5000);

    }

}

function createGroupCategory(){
    
    let title = $('#title').val().trim();
    let description = $('#description').val().trim();

    // DEADLINE NOT SUPPORTED BY API
    // TODO: SWITCH TO SUBMITTING FORM DATA
    // let format = "YYYY-MM-DD HH:mm";
    // let deadlineDate = $('#deadline_date').val();
    // let deadlineTime = $('#deadline_time').val();
    
    // let deadlineUTCDateTime = convertToUTCDateTimeString(moment(deadlineDate + " " + deadlineTime, format));

    let category = {
        "Name": title,
        "Description": {"Content": description, "Type":"Text"},
        "EnrollmentStyle": "PeoplePerNumberOfGroupsSelfEnrollment",
        "EnrollmentQuantity": null,
        "AutoEnroll": false,
        "RandomizeEnrollments": false,
        "NumberOfGroups": newTimeSlots.length,
        "MaxUsersPerGroup": 1,
        "AllocateAfterExpiry": false,
        "SelfEnrollmentExpiryDate": null, //deadlineUTCDateTime, //<string:UTCDateTime>( yyyy-MM-ddTHH:mm:ss.fffZ )|null,
        "GroupPrefix": null,
        "RestrictedByOrgUnitId": null,
        "DescriptionsVisibleToEnrolees": true
    };
    
    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/', category);
    
}

async function updateGroupCategory(){

    let title = $('#title').val().trim();
    let description = $('#description').val().trim();

    // DEADLINE NOT SUPPORTED BY API
    // TODO: SWITCH TO SUBMITTING FORM DATA
    // let format = "YYYY-MM-DD HH:mm";
    // let deadlineDate = $('#deadline_date').val();
    // let deadlineTime = $('#deadline_time').val();
    
    // let deadlineUTCDateTime = convertToUTCDateTimeString(moment(deadlineDate + " " + deadlineTime, format));

    let category = {
        "Name": title,
        "Description": {"Content": description, "Type":"Text"},
        "EnrollmentStyle": "PeoplePerNumberOfGroupsSelfEnrollment",
        "EnrollmentQuantity": null,
        "AutoEnroll": false,
        "RandomizeEnrollments": false,
        "NumberOfGroups": null,
        "MaxUsersPerGroup": 1,
        "AllocateAfterExpiry": false,
        "SelfEnrollmentExpiryDate": null, //deadlineUTCDateTime, //<string:UTCDateTime>( yyyy-MM-ddTHH:mm:ss.fffZ )|null,
        "GroupPrefix": null,
        "RestrictedByOrgUnitId": null,
        "DescriptionsVisibleToEnrolees": true
    };
    
    return bs.put('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID, category);

}

function createGroup(timeSlot){
    
    let group = {
        "Name": timeSlot.start.format('MMM Do YYYY h:mm A') + '-' + timeSlot.end.format('h:mm A'),
        "Code": "",
        "Description": { "Content": "", "Type": "Text" },
    }

    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/', group);
    
}

async function updateGroup(timeSlot){
    
    let group = {
        "Name": timeSlot.start.format('MMM Do YYYY h:mm A') + '-' + timeSlot.end.format('h:mm A'),
        "Code": convertToUTCDateTimeString(timeSlot.start, true) + '_' + convertToUTCDateTimeString(timeSlot.end, true) + '_' + timeSlot.eventId,
        "Description": { "Content": "", "Type": "Text" }
    };

    return bs.put('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + timeSlot.groupId, group);
    
}

function createCalendarEvent(timeSlot){

    let event_title = $('#event_title').val().trim();
    if(event_title == ''){
        event_title = $('#title').val().trim();
    }

    let event = {
        "Title": event_title,
        "Description": "",
        "StartDateTime": convertToUTCDateTimeString(timeSlot.start),
        "EndDateTime": convertToUTCDateTimeString(timeSlot.end),
        "StartDay": null,
        "EndDay": null,
        "GroupId": timeSlot.groupId,
        "RecurrenceInfo": null,
        "LocationId": null,
        "LocationName": "",
        "AssociatedEntity": null,
        "VisibilityRestrictions": {
            "Type": 1,
            "Range": null,
            "HiddenRangeUnitType": null,
            "StartDate": null,
            "EndDate": null
        }
    };

    return bs.post('/d2l/api/le/(version)/(orgUnitId)/calendar/event/', event);
   
}

async function updateCalendarEvent(timeSlot){
    let event_title = $('#event_title').val().trim();
    if(event_title == ''){
        event_title = $('#title').val().trim();
    }

    let event = {
        "Title": event_title,
        "Description": "",
        "StartDateTime": convertToUTCDateTimeString(timeSlot.start),
        "EndDateTime": convertToUTCDateTimeString(timeSlot.end),
        "StartDay": null,
        "EndDay": null,
        "GroupId": timeSlot.groupId,
        "RecurrenceInfo": null,
        "LocationId": null,
        "LocationName": "",
        "AssociatedEntity": null,
        "VisibilityRestrictions": {
            "Type": 1,
            "Range": null,
            "HiddenRangeUnitType": null,
            "StartDate": null,
            "EndDate": null
        }
    };

    return bs.put('/d2l/api/le/(version)/(orgUnitId)/calendar/event/' + timeSlot.eventId, event);
}


async function createTopic(){

    let title = $('#title').val().trim();

    let response = await fetch(PLUGIN_PATH + '/resources/html/landing.tpl');
    let content = await response.text();
    content = content.replace(/\(pluginPath\)/g, PLUGIN_PATH);
    content = content.replace(/\(orgUnitId\)/g, ORG_UNIT_ID);
    content = content.replace(/\(groupCategoryId\)/g, GROUP_CATEGORY_ID);
    
    let topic = [
        {
            "IsHidden": false,
            "IsLocked": false,
            "ShortTitle": null,
            "Type": 1,
            "DueDate": null,
            "Url": orgUnitInfo.Path + "Scheduler.html",
            "StartDate": null,
            "TopicType": 1,
            "EndDate": null,
            "Title": title
        },
        content
    ];

    return bs.post('/d2l/api/le/(version)/(orgUnitId)/content/modules/' + targetModuleId + '/structure/?renameFileIfExists=true', topic);

}

async function updateTopic(){

    let title = $('#title').val().trim();

    let topic = await bs.get('/d2l/api/le/(version)/(orgUnitId)/content/topics/' + TOPIC_ID);

    topic = {
        "Title": title,
        "ShortTitle": "",
        "Type": 1,
        "TopicType": 1,
        "Url": topic.Url,
        "IsHidden": false,
        "IsLocked": false,
        "MajorUpdateText": ""        
    }

    return bs.put('/d2l/api/le/(version)/(orgUnitId)/content/topics/' + TOPIC_ID, topic);

}

function sendEmail(address, subject, body){

    let calendarSubscription = bs.get('/d2l/le/calendar/(orgUnitId)/subscribe/subscribeDialogLaunch?subscriptionOptionId=-1');
    let feedToken = calendarSubscription.match(/feed\.ics\?token\=([a-zA-Z0-9]+)/)[1];
    let feedUrl = feedToken;

    body = body.replace(/\(feedUrl\)/g, feedUrl);

    let formData = {
        "ToAddresses$items$Value":address,
        "ToAddresses$items$Key": "",
        "ToAddresses$items$ActionType": "Add",
        "ToAddresses$items`1$Value": "",
        "ToAddresses$items`1$Key": "",
        "ToAddresses$items`1$ActionType": "",
        "AutoCompleteTo$SelectionInfo$value": address,
        "AutoCompleteTo$SelectionInfo$key": "",
        "CcAddresses$items$Value": "",
        "CcAddresses$items$Key": "",
        "CcAddresses$items$ActionType": "None",
        "AutoCompleteCc$SelectionInfo$value": "",
        "AutoCompleteCc$SelectionInfo$key": -1,
        "BccAddresses$items$Value": "",
        "BccAddresses$items$Key": "",
        "BccAddresses$items$ActionType": "None",
        "AutoCompleteBcc$SelectionInfo$value": "",
        "AutoCompleteBcc$SelectionInfo$key": -1,
        "AddedToAddresses": "",
        "AddedCcAddresses": "",
        "AddedBccAddresses": "",
        "DraftMessageId": 0,
        "ParentMessageId": 0,
        "ParentMessageStatus": 0,
        "Subject": subject,
        "BodyHtml$id": "BodyHtml",
        "BodyHtml$htmlOrgUnitId": ORG_UNIT_ID,
        "BodyHtml$html":body,
        "Priority": 3,
        "Attachments$files$ActionType": "None",
        "Attachments$files$PluginKey": "",
        "Attachments$files$Id": "",
        "Attachments$files$FileSize": "",
        "isXhr": true,
        "requestId": 18
    };

    return bs.submit(url, formData);
}

async function deleteTimeSlot(timeSlot, requiresConfirmation = true){

    if(requiresConfirmation && !confirm('Are you sure you want to delete this time slot?\n\nIt will remove all registrations and associated events for this time.')){
        return false;
    }

    $('#timeslot_' + timeSlot.groupId).remove();

    await cancelTimeSlot(timeSlot, false);
    await deleteCalendarEvent(timeSlot.eventId);
    await deleteGroup(timeSlot.groupId);

    // remove timeSlot from existingTimeSlots
    existingTimeSlots = existingTimeSlots.filter(function( ets ) {
        return ets.groupId !== timeSlotId;
    });

}

function cancelTimeSlot(timeSlot, requiresConfirmation = true){
    if(requiresConfirmation && !confirm('Are you sure you cancel this registration?\n\nThe student will be removed and they will be able to select a different time.')){
        return false;
    }

    timeSlot.student = false;
    $('#timeslot_' + groupId + ' .timeslot_student').html('&nbsp;-&nbsp;');
    $('#timeslot_' + groupId).find('.cancel-timeslot').remove();
    return unenrolFromGroup(groupId, student);
}


function unenrolFromGroup(groupId, student){
    return bs.delete('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + groupId + '/enrollments/' + student);
}

function deleteCalendarEvent(eventId){
    
    return bs.delete('/d2l/api/le/(version)/(orgUnitId)/calendar/event/' + eventId);

}

function deleteGroup(groupId){
    
    return bs.delete('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + groupId);
    
}

async function getClassList(){
    let classList = [];
    for(student of await bs.get('/d2l/api/le/(version)/(orgUnitId)/classlist/')){
        classList[student.Identifier] = student;
    }
    return classList;
}

function loading(){
    $('.main').children().toggle();
    $('#loading').toggle();
}

function errorMessage(message, id = null, callback = null){
    
    if(id !== null){
        if(typeof(id) == 'string')
            $('#' + id).addClass('error');
        else
            $(id).addClass('error');
    }
    
    $('#messageModel').find('.modal-title').html('Error');
    $('#messageModal').find('.modal-body').html('<p>' + message + '</p>');

    if(callback !== null){
        $('#messageModal').find('.modal-footer').find('btn-primary').on('click', callback);
    }

    // is it in an iframe?
    let theWindow = window.self === window.top ? window : window.parent;

    $('#messageModal').css('top', $(theWindow).scrollTop() + 'px');

    $('#messageModal').modal('show');

}

function clearErrorMessage(id){
    $('#' + id).removeClass('error');
}

function momentFromTime(time){

    let defaultDate = '2020-01-01 ';
    let defaultDateTimeFormat = 'YYYY-MM-DD HH:mm';

    return moment(defaultDate + time, defaultDateTimeFormat);

}

function convertToUTCDateTimeString(date, safe = false){

    let utcDate = date.clone().utc();

    let format;

    if(safe){
        format = 'YYYYMMDDHHmm';
    } else {
        format = 'YYYY-MM-DDTHH:mm:00.000';
    }

    return utcDate.format(format) + (safe ? '' : 'Z');

}