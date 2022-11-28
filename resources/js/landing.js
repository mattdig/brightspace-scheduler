async function redirect(){
    let isInstructor = await isInstructor();
    let redirect = PLUGIN_PATH + '/' + (isInstructor ? 'setup' : 'signup') + '.html?ou=' + ORG_UNIT_ID + '&gc=' + GROUP_CATEGORY_ID;
    window.location.replace(redirect);
}
redirect();