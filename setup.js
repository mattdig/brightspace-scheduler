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

    new_datetime.find('h3').text('Date & Time ' + new_length);
    new_datetime.find('label.date_label').attr('for', 'date_' + new_length);
    new_datetime.find('label.starttime_label').attr('for', 'starttime_' + new_length);
    new_datetime.find('label.endtime_label').attr('for', 'endtime_' + new_length);
    
    new_datetime.find('input.date_input').attr('id', 'date_' + new_length).attr('name', 'date_' + new_length).val('');
    new_datetime.find('input.time_input').first().attr('id', 'starttime_' + new_length).attr('name', 'starttime_' + new_length).val('');
    new_datetime.find('input.time_input').last().attr('id', 'endtime_' + new_length).attr('name', 'endtime_' + new_length).val('');
    
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

    $(datetime_elem).find('.date_input').datetimepicker({
        format: 'YYYY-MM-DD',
    });

    $(datetime_elem).find('.time_input').datetimepicker({
        format: 'LT',
        stepping: 15,
    });
        
            // let no_overlap = true;            
            // time_blocks.some(function(time_block){
            //     // if the new datetime overlaps with an existing time block, remove it
            //     if(start.isBetween(time_block.start, time_block.end) || end.isBetween(time_block.start, time_block.end)){
            //         no_overlap = false;
            //         error_message('The date range you selected overlaps with an existing time block.', time_block.id);
            //         return false;
            //     }
            // });

            // if(no_overlap){
            //     clear_error_message(id);

            //     time_blocks.push({
            //         id: id,
            //         start: start,
            //         end: end
            //     });

            //     if(end > latest_time){
            //         latest_time = end;
            //     }
    
            //     update_total_time();
            // } else {
            //     $('#' + id + '_content').html("");
            // }

}

function error_message(message, id){
    $('#' + id).addClass('error');
    $('#messageModel').find('.modal-title').html('Error');
    $('#messageModal').find('.modal-body').html(message);
    $('#messageModal').modal('show');
}

function clear_error_message(id){
    $('#' + id).removeClass('error');
}


function validate(){
    let title = $('#title').val();
    let datetimes = [];

    $('.datetime__div').each(function(){
        let datetime = {};
        datetime['start'] = $(this).find('input').data('datetimepicker').startDate.format('YYYY-MM-DD HH:mm:ss');
        datetime['end'] = $(this).find('input').data('datetimepicker').endDate.format('YYYY-MM-DD HH:mm:ss');
        datetimes.push(datetime);
    });

    $('#time_blocks').val(parseInt($('#time_blocks').val()));
    $('#time_block_size').val(parseInt($('#time_block_size').val()));

    let valid = true;

    if(title == ''){
        $('#title').addClass('error');
        valid = false;
    }
    if(time_blocks == ''){
        $('#time_blocks').addClass('error');
        valid = false;
    }
    $('.datetime__input').each(function(){
        if($(this).val() == ''){
            $(this).addClass('error');
            valid = false;
        }
    });
}