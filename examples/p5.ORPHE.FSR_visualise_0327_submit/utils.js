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



function buildElement(name_tag, innerHTML, str_class, str_style, element_appended) {
    let element = document.createElement(name_tag);
    element.innerHTML = innerHTML;
    element.classList = str_class;
    if (str_style != '') {
        element.setAttribute('style', str_style);
    }
    element_appended.appendChild(element);
    return element;
}