/**
 * Get the URL parameter value
 * https://www-creators.com/archives/4463
 * @param  name {string} パラメータのキー文字列
 * @return  url {url} 対象のURL文字列（任意）
 */
function getParam(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

var s_time = Date.now();
function millis() {
    let e_time = Date.now();;
    let diff = e_time - s_time;
    //console.log("経過時間(ミリ秒):", diff);
    return diff;
}
