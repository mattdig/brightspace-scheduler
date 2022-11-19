class Brightspace{

    constructor(orgUnitId = false){
        
        if(orgUnitId !== false && orgUnitId !== null){
            this.ou = orgUnitId;
        }else{
            this.ou = false;
        }

        this.versions = {
            le : '1.53',
            lp : '1.42'
        };
    }

    get(url){
        let response = this.send('get', url);
        return response;
    }

    post(url, data){
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

        let token = false;

        if(verb !== 'get'){
            token = await this.getToken();
        }

        if(type == 'form'){
            data.d2l_referrer = token.referrerToken;
            data.d2l_hitcode = token.hitCodePrefix + "100000001";
            data = new URLSearchParams(data).toString();
        } else if (verb != 'get') {
            data = JSON.stringify(data);
        }
        
        return new Promise((resolve, reject) => {

            url = this.process(url);

            let xhr = new XMLHttpRequest();
            
            xhr.open(verb, url);
            
            if(verb !== 'get' && type !== 'form'){
                xhr.setRequestHeader('X-Csrf-Token', token.referrerToken);
            }

            if(data !== false){
                if(type == 'form'){
                   xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
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
                            response = response.substr(second); 
                        } else {
                            response = response.substr(first + 2);
                        }
                    }

                    if(response.substr(0, 1) == '{'){
                        resolve(JSON.parse(response));
                    } else {
                        resolve(response);
                    }

                } else {

                    let response = xhr.response;

                    if(response.substr(0, 1) == '{'){
                        response = JSON.parse(response);
                    } else {
                        response = {'Error': response};
                    }
                    resolve(response);
                }
            }

            if(data !== false){
                xhr.send(data);
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