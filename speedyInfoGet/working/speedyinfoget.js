//papago
const TOKEN ='[line channel access token]'
const PAPAGO_URL = 'https://openapi.naver.com/v1/papago/n2mt'
const TARGET_URL = 'https://api.line.me/v2/bot/message/reply'
const Azurepath = '/text/analytics/v2.1/keyPhrases'
const endpoint = "https://westcentralus.api.cognitive.microsoft.com/text/analytics"


/*정보 지우고 제출*/
const PAPAGO_ID = '[papago_id]'
const PAPAGO_SECRET = '[papago_secret]'
const subscription_key = '[azure_subscription_key]'
/*정보 지우고 제출*/

var express = require('express');
const request = require('request');
const fs = require('fs');
const path = require('path');
const HTTPS = require('https');
const https = require ('https');
const domain = "www.satelliteheart.tk"
const sslport = 23023;
const bodyParser = require('body-parser');

var app = express();

//global words
//현재 어느 상태인지 저장하기 위함
var mode = "";
//azure api이용시 답장으로 보내기 위함
var globalreplytoken = "";
//azure api이용하고 array에 저장
var sumResult = new Array();
//3줄요약하기 위해 array에 저장
var check3lines= "";
//global sentence
var globalsentence = "[빠르게 정보를 획득하세요] \n\ ";

app.use(bodyParser.json());

//라인으로 메세지 보낼 때 이용하는 함수
function postingMessage(parareplyToken,message){
    request.post(
       {
           url: TARGET_URL,
           headers: {
               'Authorization': `Bearer ${TOKEN}`
           },
           json: {
               "replyToken":parareplyToken,
               "messages":[
                   {
                       "type":"text",
                       "text":message
                   }
               ]
           }
       });
}

//중요 어구 6개만 보내기
function keyphraseMessages(parareplyToken,message){
    if(message[0] == undefined){
        postingMessage(globalreplytoken,"분석할 기사가 입력되지 않았습니다. 기사를 입력하여 핵심 구를 알아보세요!");
    }else{
        var sentence = "[중요 어구] \n\ 1. "+ message[0]+"\n\ 2. "+message[1]+ "\n\ 3. "+message[2]+ "\n\ 4. "+message[3]+ "\n\ 5. "+message[4]+ "\n\ 6. "+message[5];
        globalsentence += (" \n\ \n\ "+sentence);
            request.post(
                {
                    url: TARGET_URL,
                    headers: {
                       'Authorization': `Bearer ${TOKEN}`
                   },
                   json: {
                        "replyToken":parareplyToken,
                         "messages":[
                             {
                                 "type":"text",
                                 "text": sentence 
                             } 
                         ]
                 }
            });
    }
}

//요약 api에게 요청 보내기
function get_key_phrases  (documents) {
    var body = JSON.stringify(documents);
    var request_params = {
        method: 'POST',
        hostname: (new URL(endpoint)).hostname,
        path: Azurepath,
        headers: {
            'Ocp-Apim-Subscription-Key': subscription_key,
        }
    };
    var req = https.request(request_params, response_handler);
    req.write(body);
    req.end();
}

//요약 api 요청 받고 라인에게 보내기
function response_handler (response, replyToken) {
    var body = '';
    response.on('data', function (d) {
        body += d;
    });
    response.on('end', function () {
        var body_ = JSON.parse(body);
        var body__ = JSON.stringify(body_, null, '  ');
        var body__1 = body__.split("[");
        var body__2 = body__1[2].split(",");
        
        //array reset
        resetArray(sumResult);
        //array에 정보 넣기
        for(var i in body__2){
            if(body__2[i] != undefined ){
                sumResult.push( body__2[i].substr(10).split('"').join(''));
            }
            else{
                //undefined 제거
                sumResult.push(body__2[i]);
                sumResult.pop();
            }
        }
        sumResult.pop();//에러 제거
        sumResult.pop();//헤드라인 제거
        //라인으로 보내기
        keyphraseMessages(globalreplytoken,sumResult);
    });
    response.on('error', function (e) {
        console.log('Error: ' + e.message);
    });
};

//array reset해서 새로 받을 준비하기
function resetArray(array){
    for (var i in sumResult){
        sumResult.pop();
        sumResult.pop();
        sumResult.pop();
        sumResult.pop();
    }
    sumResult.pop();
    console.log("array reset");
}

//검색 함수
function search(replyTocken, word){
    var mention = "[검색] \n\ 링크를 통해 더 자세한 정보를 얻으세요! \n\ 1. "+sumResult[0] + " https://www.google.com/search?q="+ encodeURI(sumResult[1]) + " \n\ 2. "+sumResult[1] + " https://www.google.com/search?q="+ encodeURI(sumResult[1]) + " \n\ 3. "+sumResult[2] + " https://www.google.com/search?q="+ encodeURI(sumResult[2])+ " \n\ 4. "+sumResult[3] + " https://www.google.com/search?q="+ encodeURI(sumResult[3]) + " \n\ 5. "+sumResult[4] + " https://www.google.com/search?q="+ encodeURI(sumResult[4])+ " \n\ 6. "+sumResult[5] + " https://www.google.com/search?q="+ encodeURI(sumResult[5]);
    postingMessage(replyTocken,mention);   
}

//번역 함수
function trans(replyToken, message) {
    request.post(
        {
            url: PAPAGO_URL,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Naver-Client-Id': `${PAPAGO_ID}`,
                'X-Naver-Client-Secret': `${PAPAGO_SECRET}`
            },
            form: {'source':'en', 'target':'ko', 'text': message},
            json:true
        },(error, response, body) => {
            if(!error && response.statusCode == 200) {
                var transMessage = body.message.result.translatedText;
                var temp =("[번역기사]\n\ "+transMessage);
                //라인으로 보내기
                postingMessage(replyToken,temp);
                globalsentence += ("\n\ \n\ "+temp);
            }
        });
}

//3줄 요약 함수
function for3lines(article,wordarray){
    var treat = new Array();
    var threelines =new Array();
    //점 기준으로 문장 분해
    var temp = article.split('.');
    for (var i in temp ){
        treat.push(temp[i]);
    };
    //treat에서 한문장씩 가져와서 단어 찾기
    for ( var k in wordarray){
        for ( var i in treat){
            if(treat[i].indexOf(wordarray[k]) != -1)
            {
                threelines.push(treat[i]);
            }
        }
    }
    var complete = "[3줄 요약] \n\ 1. \n\ \n\ "+threelines[0]+" \n\ \n\ 2. "+ threelines[1]+" \n\ \n\ 3. "+threelines[2];
    postingMessage(globalreplytoken,complete);
    globalsentence += ("\n\ \n\ "+complete);
    resetArray(treat);
}

//라인에서 메세지(mode) 받고 switch문 통해서 함수로 이동
app.post('/hook', function (request,response) {
    var eventObj = request.body.events[0];
    //요약 이용시 replytoken 얻기 위함
    globalreplytoken = eventObj.replyToken;
    switch(eventObj.message.text)
    {
        case '안녕' :
            var temp = " 반갑습니다! \n\ 번역을 원한다면 '번역'을 입력하고 기사를 입력해 주세요. \n\ 핵심 구를 알고 싶다면 '요약'을 입력 후 기사를 입력해 주세요. \n\ 검색하고 싶은 단어가 있다면 '검색'을 입력하면 관련 링크가 뜹니다. '3줄'을 입력하면 핵심 구를 기준으로 판별하여 중요한 3문장을 받을 수 있습니다. \n\n\ '한번에'를 입력하여 확인한 기능을 한번에 모아 보세요! ";
            postingMessage(eventObj.replyToken,temp);
            console.log("[information message sent]");
            break;  
        case '요약':
            mode = 'summery';
            console.log('[now state]', eventObj.message.text);
            break;    
        case '번역':
            mode = 'trans';
            console.log('[now state]', eventObj.message.text);
            break;
        case '검색' :
            mode = 'search';
            console.log('[now state]', eventObj.message.text);
            search(eventObj.replyToken, eventObj.message.text);
            break;
        case '3줄' :
            console.log('[now state]', eventObj.message.text);
            for3lines(check3lines, sumResult);
            break;
        case '한번에' :           
            postingMessage(eventObj.replyToken,globalsentence);
            break;
        default :
            if(mode == 'trans'){
                trans(eventObj.replyToken, eventObj.message.text);
            }
            else if (mode == 'summery'){
                let documents = {
                    'documents': [
                        { 'id': '1', 'language': 'en', 'text': eventObj.message.text },
                    ]
                };
                get_key_phrases(documents);
                check3lines = eventObj.message.text;
            }
            //위에 있는 입력 조건에 맞지 않으면 다시 입력
            else{
                postingMessage(eventObj.replyToken,"다시 입력해주세요");
            }
        };
    eventObj.message.text = undefined;
    response.sendStatus(200);
});

//서버 연결
try {
    const option = {
      ca: fs.readFileSync('/etc/letsencrypt/live/' + domain +'/fullchain.pem'),
      key: fs.readFileSync(path.resolve(process.cwd(), '/etc/letsencrypt/live/' + domain +'/privkey.pem'), 'utf8').toString(),
      cert: fs.readFileSync(path.resolve(process.cwd(), '/etc/letsencrypt/live/' + domain +'/cert.pem'), 'utf8').toString(),
    };
    HTTPS.createServer(option, app).listen(sslport, () => {
      console.log(`[HTTPS] Server is started on port ${sslport}`);
    });
  }
  catch (error) {
    console.log('[HTTPS] HTTPS 오류가 발생하였습니다. HTTPS 서버는 실행되지 않습니다.');
    console.log(error);
  }