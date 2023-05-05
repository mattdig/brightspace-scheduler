class Brightspace{

    constructor(orgUnitId = false){
        
        if(orgUnitId !== false && orgUnitId !== null){
            this.ou = orgUnitId;
        }else{
            this.ou = false;
        }

        this.versions = {
            le : '1.70',
            lp : '1.42'
        };
    }

    get(url){
        let response = this.send('get', url);
        return response;
    }

    post(url, data, ){
        let response = this.send('post', url, data);
        return response;
    }

    put(url, data){
        let response = this.send('put', url, data);
        return response;
    }

    delete(url){
        let response = this.send('delete', url);
        return response;
    }

    submit(url, data){
        let response = this.send('post', url, data, 'form');
        return response;
    }

    async send(verb, url, data = false, type = 'json'){

        let dataString = '';
        let token = false;

        let boundary = '------' + Math.random().toString().substring(2);

        if(verb !== 'get'){
            token = await this.getToken();
        }

        if(type == 'form'){
            data.d2l_referrer = token.referrerToken;
            data.d2l_hitcode = token.hitCodePrefix + "100000001";
            dataString = new URLSearchParams(data).toString();
        } else if (verb != 'get') {

            if(typeof data == 'object' && data[0] === undefined){
                dataString = JSON.stringify(data);
            } else if(typeof data == 'array' || data[0] !== undefined){
                dataString = '';
                data.forEach(function(item){
                    dataString += '--' + boundary + '\r\n';
                    if(typeof item == 'object'){
                        dataString += 'Content-Type: application/json\r\n\r\n' + 
                                      JSON.stringify(item) + '\r\n';
                    } else if (typeof item == 'string' && item.substring(0, 1) == '<'){
                        dataString += 'Content-Disposition: form-data; name=""; filename="file.htm"\r\nContent-Type: text/html\r\n\r\n' + 
                                      item + '\r\n';
                    } else {
                        dataString += 'Content-Disposition: form-data; name=""; filename="file.txt"\r\nContent-Type: text/plain\r\n\r\n' + 
                                      item + '\r\n';
                    }
                });
                dataString += '--' + boundary + '--';

            }
        }
        
        return new Promise((resolve, reject) => {

            url = this.process(url);

            let xhr = new XMLHttpRequest();
            
            xhr.open(verb, url);
            
            if(verb !== 'get' && type !== 'form'){
                xhr.setRequestHeader('X-Csrf-Token', token.referrerToken);
            }

            if(dataString !== ''){
                if(type == 'form'){
                    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                } else if(dataString.substring(0,boundary.length + 2) == '--' + boundary){
                    xhr.setRequestHeader("Content-Type", "multipart/mixed; boundary=" + boundary);
                } else {
                    xhr.setRequestHeader('Content-Type', 'application/json');
                }
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    
                    let response = xhr.response;
                    // D2L returns a while loop in JSON, so we need to parse it out
                    if(response.indexOf('while') === 0){
                        // get 2nd { instance
                        let first = response.indexOf('{');
                        let second = response.indexOf('{', first + 1);

                        if(second > -1){
                            response = response.substring(second); 
                        } else {
                            response = response.substring(first + 2);
                        }
                    }

                    if(response.substring(0, 1) == '{' || response.substring(0, 1) == '['){
                        resolve(JSON.parse(response));
                    } else {
                        resolve(response);
                    }

                } else {

                    // nothing is rejected because we want to handle the error in the calling function
                    let response = xhr.response;

                    if(response.substring(0, 1) == '{'){
                        response = JSON.parse(response);
                    } else {
                        response = {'Error': response};
                    }
                    resolve(response);
                }
            }

            if(dataString !== ''){
                xhr.send(dataString);
            } else {
                xhr.send();
            }

        });
       
    }

    getToken(){
        let token = this.get('/d2l/lp/auth/xsrf-tokens');
        return token;
    }

    process(url){
            
        let version = this.versions.le;

        if(url.indexOf('/lp/') > -1){
            version = this.versions.lp;
        }

        url = url.replace('(version)', version);

        if(this.ou !== false){
            url = url.replace('(orgUnitId)', this.ou);
        }

        return url;
    
    }
        
}