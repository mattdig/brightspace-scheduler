

let bs = new Brightspace(ORG_UNIT_ID);

let timeZone;

let globalLatestTime;

let timeBlocks = [];

let existingTimeSlots = [];
let newTimeSlots = [];

let totalTimeSlots = 0;

let defaultDate = '2020-01-01 ';
let defaultDateTimeFormat = 'YYYY-MM-DD HH:mm';

$(function() {
    setup();
});

async function setup(){

    //let orgInfo = await bs.get('/d2l/api/lp/(version)/organization/info');

    timeZone = 'America/Toronto'; //orgInfo.TimeZone;

    moment.tz.setDefault(timeZone);

    updateGlobalLatestTime(moment());

    initializeDatetime( $('.datetime__div').first() );

    $('#deadline_date').datetimepicker({
        format: 'YYYY-MM-DD',
        defaultDate: moment(),
        maxDate: moment().clone().add(1, 'years')
    });

    generateTimeOptions($('#deadline_time'));



    $('#timeslot_duration').on('change', function(){
        updateTotalTimeSlots();
    });

    // $('#timeslot_number').on('change', function(){
    //     updateTotalTimeSlots();
    // });

    if(MODE == 'edit'){ 
        existingTimeSlots = await getExistingTimeSlots();
        displayExistingTimeBlocks(existingTimeSlots);
    } else {
        //initializeDatetime( $('.datetime__div') );
    }
}

async function getExistingTimeSlots(){
    let groups = await bs.get('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/');
    
    groups.forEach(async function(group) {
        
        let utcTimes = group.Name.split('-');

        let startTime = moment(utcTimes[0]);
        let endTime = moment(utcTimes[1]);

        let localDateTimeString = startTime.format('MMMM D, YYYY | h:mma') + ' - ' + endTime.format('h:mma');
        
        let timeslot = {
            start: startTime,
            end: endTime,
            name: localDateTimeString,
            groupid: group.GroupId,
            eventId: group.Code,
            student: false
        };

        if(group.Enrollments.length > 0){
            timeslot.student = await bs.get('/d2l/api/lp/(version)/users/' + group.Enrollments[0].UserId);
        }
    
        existingTimeSlots.push(timeslot);
    });
}

function displayExistingTimeSlots(timeSlots){

    let html = '';
    timeSlots.forEach(element => {
        let student = false;
        if(element.student !== false){
            student = element.student.FirstName + ' ' + element.student.LastName + ' (' + element.student.OrgDefinedId + ')';
        }

        html += '<tr class="timeslot" id="timeslot_' + element.groupId + '">';
        html += '<td class="timeslot_student" data-studentid="">' + element.student + '</td>';
        html += '<td class="timeslot_datetime">' + element.name + '</td>';
        html += '<td class="timeslot_actions">';
        if(element.student !== false){
            html += '<button class="btn btn-danger btn-sm cancel-timeslot" onclick="canelTimeSlot(' + element.groupId + ')" data-id="' + element.groupId + '">Cancel</button>';
        }
        html += '<button class="btn btn-danger btn-sm delete-timeslot" onclick="deleteTimeSlot(' + element.groupId + ')" data-id="' + element.groupId + '">Delete</button></td>';
        html += '</td>';
        html += '</tr>';
    });

    $('#existingTimeBlocks').html(html);
}

function cancelTimeSlot(id){
    unenrolFromGroup(id);
    $('#timeslot_' + id + ' .timeslot_student').html('');
}

async function deleteTimeSlot(timeSlot){
    
    await unenrolFromGroup(timeSlot.groupId);
    await deleteCalendarEvent(timeSlot.eventId);
    await deleteGroup(timeSlot.groupId);

    $('#timeslot_' + timeSlot.groupId).remove();

    // remove timeSlot from existingTimeSlots
    existingTimeSlots = existingTimeSlots.filter(function( ets ) {
        return ets.groupId !== timeSlot.groupId;
    });


}

function addDatetime(){

    let lastDatetime = $('.datetime__div').last();
    let newDatetime = lastDatetime.clone();
    let newLength = $('.datetime__div').length + 1

    newDatetime.attr('id', 'datetime_' + newLength);
    newDatetime.find('h3').text('Date & Time ' + newLength);
    newDatetime.find('label.date_label').attr('for', 'date_' + newLength);
    newDatetime.find('label.starttime_label').attr('for', 'starttime_' + newLength);
    newDatetime.find('label.endtime_label').attr('for', 'endtime_' + newLength);
    
    newDatetime.find('input.date_input').attr('id', 'date_' + newLength).attr('name', 'date_' + newLength).val('');
    newDatetime.find('input.starttime_input').attr('id', 'starttime_' + newLength).attr('name', 'starttime_' + newLength).val('');
    newDatetime.find('input.endtime_input').attr('id', 'endtime_' + newLength).attr('name', 'endtime_' + newLength).val('');
    
    newDatetime.insertAfter(lastDatetime);
    initializeDatetime($('.datetime__div').last());   // initialize the new datetime

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

function initializeDatetime(datetimeElem){

    let latestTime = globalLatestTime.clone();

    let interval = 30;

    // rount up to nearest interval minutes
    let remainder = interval - (latestTime.minute() % interval);
    latestTime.add(remainder, "minutes");


    $(datetimeElem).find('.date_input').datetimepicker({
        format: 'YYYY-MM-DD',
        defaultDate: latestTime.clone(),
        minDate: latestTime.clone(),
        maxDate: latestTime.clone().add(1, 'years')
    }).on('dp.hide', function(e){
        validateTimeFields(false);
    });

    
    latestTime = moment(defaultDate + latestTime.format('HH:mm'), defaultDateTimeFormat);
    
    let minTime = moment(defaultDate + '00:00', defaultDateTimeFormat);
    let maxTime = latestTime.clone().add(1, 'hours');

    generateTimeOptions($(datetimeElem).find('.starttime_input'), latestTime, minTime, maxTime, interval);

    minTime = latestTime.clone().add(30, 'minutes');
    maxTime = moment(defaultDate + '23:59', defaultDateTimeFormat);

    generateTimeOptions($(datetimeElem).find('.endtime_input'), latestTime.clone().add(1, 'hours'), minTime, maxTime, interval);

    $(datetimeElem).find('.starttime_input').on('change', function(){
        let object = $(datetimeElem).find('.endtime_input')
        let time = moment(defaultDate + object.val(), defaultDateTimeFormat);
        let startTime = moment(defaultDate + $(this).val(), defaultDateTimeFormat).add(interval, 'minutes');
        let endTime = moment(defaultDate + '23:59', defaultDateTimeFormat);
        generateTimeOptions(object, time, startTime, endTime, interval);
        validateTimeFields(false);
    });

    $(datetimeElem).find('.endtime_input').on('change', function(){
        let object = $(datetimeElem).find('.starttime_input')
        let time = moment(defaultDate + object.val(), defaultDateTimeFormat);
        let startTime = moment(defaultDate + '00:00', defaultDateTimeFormat);
        let endTime = moment(defaultDate + $(this).val(), defaultDateTimeFormat);
        generateTimeOptions(object, time, startTime, endTime, interval);
        validateTimeFields(false);
    });

    // minTime = latestTime.clone().add(30, 'minutes');
    // maxTime = moment([0, 0, 0, 23, 30, 0, 0]);

    
    validateTimeFields(false);

}

function generateTimeOptions(object, defaultTime = moment([2020, 1, 1, 12, 0, 0, 0]), startTime = 0, endTime = 0, interval = 60){
    let options = [];

    if(startTime === 0){
        startTime = moment([2020, 1, 1, 0, 0, 0, 0]);
    }

    if(endTime === 0){
        endTime = moment([2020, 1, 1, 23, 59, 0, 0]);
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

function errorMessage(message, id){
    
    if(typeof(id) == 'string')
        $('#' + id).addClass('error');
    else
        $(id).addClass('error');
    
    $('#messageModel').find('.modal-title').html('Error');
    $('#messageModal').find('.modal-body').html(message);
    $('#messageModal').modal('show');

}

function clearErrorMessage(id){
    $('#' + id).removeClass('error');
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

    $('.datetime__div').each(function(){
        let datetime = {};
        let format = "YYYY-MM-DD HH:mm";
        let date = $(this).find('.date_input').val() + " ";
        datetime.id = $(this).attr('id');
        datetime.start = moment(date + $(this).find('.starttime_input').val(), format);
        datetime.end = moment(date + $(this).find('.endtime_input').val(), format);
        datetimes.push(datetime);
    });

    datetimes.sort(compareStarttime);

    datetimes.every(function(datetime1, i){
        if(datetime1.start.isAfter(datetime1.end) || datetime1.start.isSame(datetime1.end)){

            if(withErrors){
                errorMessage('Start time must be before end time.', $('#' + datetime1.id).find('input'));
            }
            valid = false;
            return false;
        
        } else {

            let spliceIndexes = [];

            let noOverlapWithBlocks = datetimes.slice(i + 1).every(function(datetime2, j){
                if(datetime1.id != datetime2.id && (
                    datetime1.start.isAfter(datetime2.start) && datetime1.start.isBefore(datetime2.end) || 
                    datetime1.end.isAfter(datetime2.start) && datetime1.end.isBefore(datetime2.end) ||
                    datetime1.start.isSame(datetime2.start) || datetime1.end.isSame(datetime2.end))){
                    
                    if(withErrors){
                        errorMessage('Datetimes must not overlap.', $('#' + datetime2.id).find('input'));
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
                if(
                    datetime1.start.isAfter(datetime2.start) && datetime1.start.isBefore(datetime2.end) || 
                    datetime1.end.isAfter(datetime2.start) && datetime1.end.isBefore(datetime2.end) ||
                    datetime1.start.isSame(datetime2.start) || datetime1.end.isSame(datetime2.end)){
                    
                    if(withErrors){
                        errorMessage('New time ranges must not overlap with existing time slots.', $('#' + datetime1.id).find('input'));
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
            errorMessage('Please enter a time slot durationa of at least 5.', $('#timeslot_duration'));
            valid = false;
        }
    }

    updateGlobalLatestTime(latestTime);

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
    
    let deadlineDate = moment($('#deadline_date').val() + ' ' + $('#deadline_time').val(), 'YYYY-MM-DD HH:mm');
    if(deadlineDate.isBefore(moment())){
        errorMessage('Deadline must be after today.', [$('#deadline_date') , $('#deadline_time')]);
    }

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

function submitForm(){

    if(!validateAllFields(true)){
        return false;
    } else {
        errorMessage('Submitting...');
        return false;
    }

    // if(mode == 'create'){
    //     let groupCategory = await createGroupCategory();
    //     GROUP_CATEGORY_ID = groupCategory.groupCategoryId;
    // }

    // if(GROUP_CATEGORY_ID != null){
    //     newTimeSlots.forEach(async function(timeSlot){

    //         let group = await createGroup(timeSlot);
            
    //         if(group != null){
    //             timeSlot.groupId = group.GroupId;
                
    //             let event = await createCalendarEvent(timeSlot);
                
    //             timeSlot.eventId = event.EventId;
                
    //             await updateGroup(timeSlot);
    //         }

    //     });
    // }

    // window.location.reload();

}

function createGroupCategory(){
    
    let title = $('#title').val();
    let description = $('#description').val();

    let format = "YYYY-MM-DD hh:mm A";
    let deadlineDate = $(this).find('.deadline_date').val();
    let deadlineTime = $(this).find('.deadline_time').val();
    
    let deadlineUTCDateTime = convertToUTCDateTimeString(moment(deadlineDate + " " + deadlineTime, format));

    let category = {
        "Name": title,
        "Description": {"Content": description, "Type":"Html"}, //{"Content": <string>,"Type": "Text|Html"}
        "EnrollmentStyle": 4, //SelfEnrollmentNumberOfGroups
        //"EnrollmentQuantity": <number>|null,
        "AutoEnroll": false,
        "RandomizeEnrollments": false,
        "NumberOfGroups": 0,
        "MaxUsersPerGroup": 1,
        "AllocateAfterExpiry": false,
        "SelfEnrollmentExpiryDate": deadlineUTCDateTime, //<string:UTCDateTime>( yyyy-MM-ddTHH:mm:ss.fffZ )|null,
        //"GroupPrefix": <string>|null,
        //"RestrictedByOrgUnitId": <number:D2LID>|null,
        "DescriptionsVisibleToEnrolees": false  // Added with LP API version 1.42
    };
    
    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/', category);
    
}

function createGroup(timeSlot){
    
    let group = {
        "Name": convertToUTCDateTimeString(timeSlot.start) + '-' + convertToUTCDateTimeString(timeSlot.end),
        "Code": "",
        "Description": { "Content": "", "Type": "Text" },
    }

    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/', group);
    
}

function updateGroup(timeSlot){
    
    let group = {
        "Name": convertToUTCDateTimeString(timeSlot.start) + '-' + convertToUTCDateTimeString(timeSlot.end),
        "Code": timeSlot.eventId,
        "Description": { "Content": "", "Type": "Text" },
    }

    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/', group);
    
}

function createCalendarEvent(timeSlot){

    let event = {
        "Title": title,
        "Description": "",
        "StartDateTime": convertToUTCDateTimeString(timeSlot.start),
        "EndDateTime": convertToUTCDateTimeString(timeSlot.end),
        //"StartDay": <string:LocalDateTime>|null,
        //"EndDay": <string:LocalDateTime>|null,
        "GroupId": timeSlot.groupId,
        "RecurrenceInfo": {
            "RepeatType": 2,
            "RepeatEvery": 1,
            "RepeatOnInfo": {
                "Monday": false,
                "Tuesday": false,
                "Wednesday": false,
                "Thursday": false,
                "Friday": false,
                "Saturday": false,
                "Sunday": false
            },
            "RepeatUntilDate": convertToUTCDateTimeString(timeSlot.end)
        },
        //"LocationId": <number:D2LID>|null,
        "LocationName": "",
        //"AssociatedEntity": { <composite:Calendar.AssociatedEntity> },
        "VisibilityRestrictions": {
            "Type": 1,
            // "Range": <number>|null,
            // "HiddenRangeUnitType": <number:HIDDENUNITT>|null,
            // "StartDate": <string:UTCDateTime>|null,
            // "EndDate": <string:UTCDateTime>|null,
        }
    };

    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/calendar/event/', event);
   
}

function unenrolFromGroup(groupId,userId){
    
    return bs.delete('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + groupId + '/enrollments/' + userId);
    
}

function deleteCalendarEvent(eventId){
    
    return bs.delete('/d2l/api/le/(version)/(orgUnitId)/calendar/event/' + eventId);

}

function deleteGroup(groupId){
    
    return bs.delete('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + groupId);
    
}

function loading(){
    $('.main').children().toggle();
    $('#loading').toggle();
}

function convertToUTCDateTimeString(date){

    let utcDate = date.clone().utc();

    return utcDate.format('YYYY-MM-DDTHH:mm:00.000') + 'Z';

}