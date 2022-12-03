async function redirect(){
    let redirect = PLUGIN_PATH + '/' + ((await isInstructor()) ? 'setup' : 'signup') + '.html?ou=' + ORG_UNIT_ID + '&gc=' + GROUP_CATEGORY_ID;
    window.location.replace(redirect);
}

window.onload = function(event) {
    redirect();
};