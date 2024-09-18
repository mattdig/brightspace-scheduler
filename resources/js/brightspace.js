class Brightspace{

    constructor(orgUnitId = false){
        
        if(orgUnitId !== false && orgUnitId !== null){
            this.ou = orgUnitId;
        }else{
            this.ou = false;
        }

        this.versions = {
            bas : 1.3,
            bfp : 1.0,
            ep : 2.5,
            ext : 1.3,
            le : 1.75,
            link : 1.0,
            lp : 1.47,
            LR : 1.3,
            lti : 1.3,
            rp : 1.4
        };
    }

    async applyLatestApiVersions(){
        let response = await bs.get('/d2l/api/versions/');
        
        for(const api of response){
            if(api.ProductCode in this.versions){
                this.versions[api.ProductCode] = api.LatestVersion;
            }
        }
    }

    get(url){
        //keep requests local to the Brightspace domain
        let d2lPos = url.indexOf('/d2l/');
        if(d2lPos > -1){
            url = url.substring(d2lPos);
        }
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
        let contentTypes = [];
        let token = false;

        let boundary = '------' + Math.random().toString().substring(2);

        if(verb !== 'get'){
            token = await this.getToken();
        }

        if(type == 'form'){
            data.d2l_referrer = token.referrerToken;
            data.d2l_hitcode = token.hitCodePrefix + "100000001";
            dataString = new URLSearchParams(data).toString();
        } else if (verb == 'post' || verb == 'put') {

            if(typeof data == 'object' && data[0] === undefined){
                dataString = JSON.stringify(data);
            } else if(data instanceof Array){
                dataString = '';
                data.forEach(function(item){
                    dataString += '--' + boundary + '\r\n';
                    if(typeof item == 'object'){
                        dataString += 'Content-Type: application/json\r\n\r\n' + 
                                      JSON.stringify(item) + '\r\n';
                        if(!contentTypes.includes('application/json')){
                            contentTypes.push('application/json');
                        }

                    } else if(typeof item == 'string' && item.substring(0,1) == '{'){
                        dataString += 'Content-Type: application/json\r\n\r\n' + 
                                      item + '\r\n';
                        if(!contentTypes.includes('application/json')){
                            contentTypes.push('application/json');
                        }

                    } else if (item.substring(0, 20) == 'Content-Disposition:') {
                        dataString += item + '\r\n';
                        if(!contentTypes.includes('form-data')){
                            contentTypes.push('form-data');
                        }

                    } else if (typeof item == 'string' && item.substring(0, 1) == '<'){
                        dataString += 'Content-Disposition: form-data; name=""; filename="file.htm"\r\nContent-Type: text/html\r\n\r\n' + 
                                      item + '\r\n';
                        if(!contentTypes.includes('form-data')){
                            contentTypes.push('form-data');
                        }

                    } else {
                        dataString += 'Content-Disposition: form-data; name=""; filename="file.txt"\r\nContent-Type: text/plain\r\n\r\n' + 
                                      item + '\r\n';
                        if(!contentTypes.includes('form-data')){
                            contentTypes.push('form-data');
                        }
                    }
                });
                dataString += '--' + boundary + '--';

            } else {
                dataString = data;
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
                    xhr.setRequestHeader("Content-Type", "multipart/" + (contentTypes.length > 1 ? 'mixed' : 'form-data') + "; boundary=" + boundary);
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

                        if(response.indexOf('while(1);') === 0){
                            response = response.substring(first);
                        } else if(second > -1){
                            response = response.substring(second); 
                        } else {
                            response = response.substring(first + 2);
                        }
                    }

                    if(response.substring(0, 1) == '{' || response.substring(0, 1) == '['){
                        response = JSON.parse(response);
                        
                        let nextData = true;

                        if(response.Next !== undefined && response.Next !== null){
                            nextData = this.get(response.Next).then(function(next){
                                if(response.Items !== undefined){
                                    response.Items = response.Items.concat(next.Items);
                                } else if(response.Objects !== undefined){
                                    response.Objects = response.Objects.concat(next.Objects);
                                }
                            });
                        }
                        
                        Promise.all([response, nextData]).then(function(values){
                            resolve(values[0]);
                        });
                        
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

            if(xhr.status >= 400){
                reject({Error: xhr.status});
            }

        });
       
    }

    getToken(){
        let token = this.get('/d2l/lp/auth/xsrf-tokens');
        return token;
    }

    process(url){
            
        let version;

        for (const [key, value] of Object.entries(this.versions)) {
            if(url.indexOf('/' + key + '/') > -1){
                version = value;
            }
        }

        url = url.replace('(version)', version);

        if(this.ou !== false){
            url = url.replace('(orgUnitId)', this.ou);
        }

        return url;
    
    }

    onlyUnique(value, index, array) {
        return array.indexOf(value) === index;
    }
        
}