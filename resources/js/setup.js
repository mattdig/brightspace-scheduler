let bs = new Brightspace(ORG_UNIT_ID);

let globalLatestTime = moment();
let existingTimeSlots = [];
let timeBlocks = [];
let timeSlots = [];
let totalTimeSlots = 0;

$(function() {
    setup();
});

function setup(){
    if(MODE == 'edit'){ 
        getExistingTimeSlots().then(function(){
            timeSlots = existingTimeSlots.slice();
            displayExistingTimeBlocks();
            updateTotalTime();
            initializeDatetime( $('.datetime__div') );
        });
    } else {
        initializeDatetime( $('.datetime__div') );
        //showTimeblockEditor();
    }
}

async function getExistingTimeSlots(){
    let result = await bs.get('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/');
    
    result.forEach(element => {
        existingTimeSlots.push(element);
    });
}

function displayExistingTimeSlots(){

    let html = '';
    existingTimeSlots.forEach(element => {
        html += '<tr class="timeblock" id="timeBlock_' + element.id + '">';
        html += '<td class="timeblock_student">' + element.student + '</td>';
        html += '<td class="timeblock_starttime">' + element.starttime + '</td>';
        html += '<td class="timeblock_endtime">' + element.endtime + '</td>';
        html += '<td class="timeblock_actions">';
        if(element.student !== false){
            html += '<button class="btn btn-danger btn-sm cancel-timeblock" onclick="canelTimeBlock(' + element.id + ')" data-id="' + element.id + '">Cancel</button>';
        }
        html += '<button class="btn btn-danger btn-sm delete-timeblock" onclick="deleteTimeBlock(' + element.id + ')" data-id="' + element.id + '">Delete</button></td>';
        html += '</td>';
        html += '</tr>';
    });

    $('#existingTimeBlocks').html(html);
}

function cancelTimeBlock(id){
    unenrolFromGroup(id);
}

async function deleteTimeBlock(timeBlock){
    
    await unenrolFromGroup(timeBlock.groupId);
    await deleteCalendarEvent(timeBlock.eventId);
    await deleteGroup(timeBlock.groupId);

    $('#timeblock_' + id).remove();
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

function addDatetime(){

    let lastDatetime = $('.datetime_div').last();
    let newDatetime = lastDatetime.clone();
    let newLength = $('.datetime_div').length + 1

    newDatetime.attr('id', 'datetime_' + newLength);
    newDatetime.find('h3').text('Date & Time ' + newLength);
    newDatetime.find('label.dateLabel').attr('for', 'date_' + newLength);
    newDatetime.find('label.starttimeLabel').attr('for', 'starttime_' + newLength);
    newDatetime.find('label.endtimeLabel').attr('for', 'endtime_' + newLength);
    
    newDatetime.find('input.date_input').attr('id', 'date_' + newLength).attr('name', 'date_' + newLength).val('');
    newDatetime.find('input.starttime_input').attr('id', 'starttime_' + newLength).attr('name', 'starttime_' + newLength).val('');
    newDatetime.find('input.endtime_input').attr('id', 'endtime_' + newLength).attr('name', 'endtime_' + newLength).val('');
    
    newDatetime.insertAfter(lastDatetime);
    initializeDatetime($('.datetime_div').last());   // initialize the new datetime

}

function selectTab(obj){
    $('.tabs').find('li').removeClass('active');
    $(obj).parent().addClass('active');
    $('.tabs').find('div').removeClass('active');
    $('.tabs').find($(obj).attr('href')).addClass('active');
}

function updateTotalTime(){
    let totalTime = 0;
    $('.datetime_span').each(function(){
        let time = $(this).text();
        if(time != ''){
            totalTime += parseInt(time);
        }
    });
    $('#totalTime').text('Total time: ' + totalTime + ' minutes');
    
    updateTotalTimeSlots();
}

function updateTotalTimeSlots(){
    totalTimeSlots = 0;
    let timeSlotDuration = parseInt($('#timeslot_duration').val()); 
    
    console.log(timeSlotDuration);

    timeBlocks.forEach(block => {
        totalTimeSlots += parseInt(Math.floor(block.end.diff(block.start, 'minutes') / timeSlotDuration));
    });

    $('#total_timeslots').text('This will create ' + totalTimeSlots + ' meetings of ' + timeSlotDuration + ' minutes each.');
}

function initializeDatetime(datetimeElem){

    const now = moment();

    if(globalLatestTime.hours() > 22){
        globalLatestTime = moment(globalLatestTime).add(9, 'hours');
    }
    
   
    $(datetimeElem).find('.date_input').datetimepicker({
        format: 'YYYY-MM-DD',
        defaultDate: moment(globalLatestTime),
        minDate: moment(globalLatestTime),
        maxDate: moment(globalLatestTime).add(1, 'years')
    });

    $(datetimeElem).find('.starttime_input').datetimepicker({
        format: 'LT',
        stepping: 15,
        defaultDate: moment(globalLatestTime),
        minDate: moment(globalLatestTime).startOf('day'),
        maxDate: moment(globalLatestTime).add(1, 'hours')
    }).on('dp.hide', function(e){
        $(datetimeElem).find('.endtime_input').data('DateTimePicker').minDate(e.date.add(15, 'minute'));
        validateTimeFields(false);
    });

    $(datetimeElem).find('.endtime_input').datetimepicker({
        format: 'LT',
        stepping: 15,
        defaultDate: moment(globalLatestTime).add(1, 'hours'),
        minDate: moment(globalLatestTime).subtract(1, 'hours'),
        maxDate: moment(globalLatestTime).endOf('day'),
    }).on('dp.hide', function(e){
        $(datetimeElem).find('.starttime_input').data('DateTimePicker').maxDate(e.date.subtract(15, 'minute'));
        validateTimeFields(false);
    });

    validateTimeFields(false);

}

function updateGlobalLatestTime(newTime){
    
    if(newTime == globalLatestTime){
        if(globalLatestTime.hours() <= 22){
            globalLatestTime = globalLatestTime + moment.duration({days:1});
        } else {
            globalLatestTime = globalLatestTime + moment.hours({hours:9});
        }
    } else {
        if(newTime > globalLatestTime){
            globalLatestTime = newTime;
        }
    }
    
}

function errorMessage(message, id){
    
    if(typeof(id) == 'string')
        $('#' + id).addClass('error');
    else
        id.addClass('error');
    
    $('#messageModel').find('.modal-title').html('Error');
    $('#messageModal').find('.modal-body').html(message);
    $('#messageModal').modal('show');

}

function clearErrorMessage(id){
    $('#' + id).removeClass('error');
}


function validateTimeFields(withErrors){
    valid = true;
    timeSlots = [];
    timeBlocks = [];
    totalTimeSlots = 0;

    let datetimes = [];
    
    let latestTime = 0;

    let selectedTab = $('.tab-pane.active').find('label').attr('for');
    let blockValue = parseInt($('#' + selectedTab).val());

    $('.datetime_Div').each(function(){
        let datetime = {};
        let format = "YYYY-MM-DD hh:mm A";
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

            let splice_indexes = [];

            let noOverlap = datetimes.slice(i + 1).every(function(datetime2, j){
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
                        datetime1.end = datetime2.end;
                        spliceIndexes.push(i + j + 1);
                    }

                    return true;
                }
            });

            if(noOverlap == false){
                return false;
            } else {

                timeBlocks.push(datetime1);

                spliceIndexes.forEach(function(index){
                    datetimes.splice(index, 1);
                });
                
                if(datetime1.end.isAfter(latestTime)){
                    latestTime = datetime1.end;
                }
                return true;
            }
        }
    });

    if(blockValue == ''){
        $('#' + selectedTab).addClass('error');
        valid = false;
        return false;
    }

    if(valid){
        updateTotalTimeSlots();
    }

    updateGlobalLatestTime(latestTime);

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

    $('input').removeClass('error');

    let valid = true;

    let title = $('#title').val();
    

    if(title == ''){
        $('#title').addClass('error');
        valid = false;
        return false;
    }
    
    validateTimeFields(true);

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

    console.log(timeSlots);
    
//     $('#' + timeBlock.id).find('.totalTime').html(totalTime.format('HH:mm'));
//     $('#' + timeBlock.id).find('.totalBlocks').html();
}

async function submit(){

    if(mode == 'create'){
        let groupCategory = await createGroupCategory();
        GROUP_CATEGORY_ID = groupCategory.groupCategoryId;
    }

    if(groupCategoryId != null){
        newTimeSlots.forEach(async function(timeSlot){
            
            let group = await createGroup(timeSlot);
            if(group != null){
                timeSlot.groupId = group.GroupId;
                let event = await createCalendarEvent(timeSlot);
                timeSlot.eventId = event.EventId;
                await updateGroup(timeSlot);
            }
        });
    }

    window.location.reload();
}

function createGroupCategory(){
    
    let title = $('#title').val();
    let description = $('#description').val();
    let deadlineUTCDateTime = $('#deadlineUTCDateTime').val();

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
        "Name": timeSlot.start.format('MMMM D, YYYY | h:mma') + ' - ' + timeSlot.end.format('h:mma'),
        "Code": "",
        "Description": { "Content": timeSlot.start.format('YYYY-MM-DD HH:MM') + '-' + timeSlot.end.format('YYYY-MM-DD HH:MM'), "Type": "Text" },
    }

    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/', group);
    
}

function updateGroup(timeSlot){
    
    let group = {
        "Name": timeSlot.start.format('MMMM D, YYYY | h:mma') + ' - ' + timeSlot.end.format('h:mma'),
        "Code": timeSlot.eventId,
        "Description": { "Content": timeSlot.start.format('YYYY-MM-DD HH:MM') + '-' + timeSlot.end.format('YYYY-MM-DD HH:MM'), "Type": "Text" },
    }

    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/', group);
    
}

function createCalendarEvent(timeSlot){

    let event = {
        "Title": title,
        "Description": "",
        "StartDateTime": convertToUTC(timeSlot.start),
        "EndDateTime": convertToUTC(timeSlot.end),
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
            "RepeatUntilDate": convertToUTCDateTime(timeSlot.end)
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

function loading(){
    $('.main').children().toggle();
    $('#loading').toggle();
}

function convertToUTCDateTime(date){

    var nowUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(),
                date.getUTCDate(), date.getUTCHours(),
                date.getUTCMinutes(), date.getUTCSeconds());

    console.log(nowUtc.toISOString());
    console.log(nowUtc.format('YYYY-MM-DDTHH:mm:ss.fff') + 'Z');

    return nowUtc.format('YYYY-MM-DDTHH:mm:ss.fff') + 'Z';

}