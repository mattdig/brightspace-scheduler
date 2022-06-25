let latest_time = moment();
let time_blocks = [];

$(function() {
    // let start = moment().startOf('hour');
    // let end = moment().startOf('hour').add(3, 'hour');
    // $('#datetime_1_content').html(start.format('YYYY MM DD') + ' - ' + end.format('YYYY MM DD') + ', ' + start.format('h:mm A') + ' - ' + end.format('h:mm A'));
    initialize_datetime($('.datetime__div').first());
});

function add_datetime(){
    let last_datetime = $('.datetime__div').last();
    let new_datetime = last_datetime.clone();
    let new_length = $('.datetime__div').length + 1

    new_datetime.attr('id', 'datetime_' + new_length);
    new_datetime.find('h3').text('Date & Time ' + new_length);
    new_datetime.find('label.date_label').attr('for', 'date_' + new_length);
    new_datetime.find('label.starttime_label').attr('for', 'starttime_' + new_length);
    new_datetime.find('label.endtime_label').attr('for', 'endtime_' + new_length);
    
    new_datetime.find('input.date_input').attr('id', 'date_' + new_length).attr('name', 'date_' + new_length).val('');
    new_datetime.find('input.starttime_input').attr('id', 'starttime_' + new_length).attr('name', 'starttime_' + new_length).val('');
    new_datetime.find('input.endtime_input').attr('id', 'endtime_' + new_length).attr('name', 'endtime_' + new_length).val('');
    
    new_datetime.insertAfter(last_datetime);
    initialize_datetime($('.datetime__div').last());   // initialize the new datetime
}

function select_tab(obj){
    $('.tabs').find('li').removeClass('active');
    $(obj).parent().addClass('active');
    $('.tabs').find('div').removeClass('active');
    $('.tabs').find($(obj).attr('href')).addClass('active');
}

function update_total_time(){
    let total_time = 0;
    $('.datetime__span').each(function(){
        let time = $(this).text();
        if(time != ''){
            total_time += parseInt(time);
        }
    });
    $('#total_time').text('Total time: ' + total_time + ' minutes');
    
    update_total_time_blocks();
}

function update_total_time_blocks(){
    let total_time_blocks = 0;
    $('.datetime__span').each(function(){
        let time = $(this).text();
        if(time != ''){
            total_time_blocks += Math.ceil(parseInt(time) / parseInt($('#time_block_size').val()));
        }
    });
    $('#total_time_blocks').text('This will create ' + total_time_blocks + ' blocks of ' + $('#time_block_size').val() + ' minutes each.');
}

function initialize_datetime(datetime_elem){

    const now = moment();

    $(datetime_elem).find('.date_input').datetimepicker({
        format: 'YYYY-MM-DD',
        defaultDate: now,
        minDate: now,
        maxDate: moment().add(1, 'years')
    });

    $(datetime_elem).find('.starttime_input').datetimepicker({
        format: 'LT',
        stepping: 15,
        defaultDate: now,
        minDate: moment().startOf('day'),
        maxDate: moment().add(1, 'hours')
    }).on('dp.hide', function(e){
        $(datetime_elem).find('.endtime_input').data('DateTimePicker').minDate(e.date.add(15, 'minute'));
    });

    $(datetime_elem).find('.endtime_input').datetimepicker({
        format: 'LT',
        stepping: 15,
        defaultDate: now + moment.duration({hours:1}),
        minDate: moment().subtract(1, 'hours'),
        maxDate: moment().endOf('day'),
    }).on('dp.hide', function(e){
        $(datetime_elem).find('.starttime_input').data('DateTimePicker').maxDate(e.date.subtract(15, 'minute')); 
    });

}

function error_message(message, id){
    
    if(typeof(id) == 'string')
        $('#' + id).addClass('error');
    else
        id.addClass('error');
    
    $('#messageModel').find('.modal-title').html('Error');
    $('#messageModal').find('.modal-body').html(message);
    $('#messageModal').modal('show');

}

function clear_error_message(id){
    $('#' + id).removeClass('error');
}


function validate(){

    $('input').removeClass('error');

    let title = $('#title').val();
    let datetimes = [];
    let total_time = 0;
    let total_blocks = 0;
    let time_block_size = 0;

    let selected_tab = $('.tab-pane.active').find('label').attr('for');
    let block_value = parseInt($('#' + selected_tab).val());

    console.log(block_value);

    $('.datetime__div').each(function(){
        let datetime = {};
        let format = "YYYY-MM-DD hh:mm A";
        let date = $(this).find('.date_input').val() + " ";
        datetime['id'] = $(this).attr('id');
        datetime['start'] = moment(date + $(this).find('.starttime_input').val(), format);
        datetime['end'] = moment(date + $(this).find('.endtime_input').val(), format);
        datetimes.push(datetime);
    });

    let valid = true;

    if(title == ''){
        $('#title').addClass('error');
        valid = false;
        return false;
    }
    
    datetimes.every(function(datetime1){
        if(datetime1['start'].isAfter(datetime1['end']) || datetime1['start'].isSame(datetime1['end'])){

            error_message('Start time must be before end time.', $('#' + datetime1['id']).find('input'));
            valid = false;
            return false;
        
        } else {
            let no_overlap = datetimes.every(function(datetime2){
                if(datetime1['id'] != datetime2['id'] && (
                    datetime1['start'].isAfter(datetime2['start']) && datetime1['start'].isBefore(datetime2['end']) || 
                    datetime1['end'].isAfter(datetime2['start']) && datetime1['end'].isBefore(datetime2['end']) ||
                    datetime1['start'].isSame(datetime2['start']) || datetime1['end'].isSame(datetime2['end']))){
                    
                    error_message('Datetimes must not overlap.', $('#' + datetime2['id']).find('input'));
                    
                    valid = false;
                    return false;
                } else {
                    return true;
                }
            });

            if(no_overlap == false){
                return false;
            } else {
                return true;
            }
        }
    });

    if(block_value == ''){
        $('#' + selected_tab).addClass('error');
        valid = false;
        return false;
    }

}