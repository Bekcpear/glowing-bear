(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.factory('ptpb', ['$rootScope', function($rootScope) {

    var process = function(image, callback) {

        // Is it an image?
        if (!image || !image.type.match(/image.*/)) return;

        upload(image, callback);
    };

    var upload = function( obj_img, callback ) {
        // Progress bars container
        var progressBars = document.getElementById("imgur-upload-progress"),
            currentProgressBar = document.createElement("div");

        // Set progress bar attributes
        currentProgressBar.className='imgur-progress-bar';
        currentProgressBar.style.width = '0';

        // Append progress bar
        progressBars.appendChild(currentProgressBar);

        // Create new form data
        var fd = new FormData();
        fd.append("c", obj_img); // Append the file

        // Create new XMLHttpRequest
        var xhttp = new XMLHttpRequest();

        // Post request to ptpb api
        xhttp.open("POST", "https://fars.ee", true);

        // Set headers
        xhttp.setRequestHeader("Accept", "application/json");

        // Handler for response
        xhttp.onload = function() {

            // Remove progress bar
            currentProgressBar.parentNode.removeChild(currentProgressBar);

            // Check state and response status
            if(xhttp.status === 200) {

                // Get response text
                var response = JSON.parse(xhttp.responseText);
                //console.log(response);

                // Send link as message
                if( response.url ) {

                    if (callback && typeof(callback) === "function") {
                        if ( response.uuid ) {
                            callback(response.url.replace(/^http:\/\//, "https://"), response.uuid);
                        } else {
                            callback(response.url.replace(/^http:\/\//, "https://"));
                        }
                    }

                } else {
                    showErrorMsg();
                }

            } else {
                showErrorMsg();
            }

        };

        if( "upload" in xhttp ) {

            // Set progress
            xhttp.upload.onprogress = function (event) {

                // Check if we can compute progress
                if (event.lengthComputable) {
                    // Complete in percent
                    var complete = (event.loaded / event.total * 100 | 0);

                    // Set progress bar width
                    currentProgressBar.style.width = complete + '%';
                }
            };

        }

        // Send request with form data
        xhttp.send(fd);

    };

    var showErrorMsg = function() {
        // Show error msg
        $rootScope.uploadError = true;
        $rootScope.$apply();

        // Hide after 5 seconds
        setTimeout(function(){
            // Hide error msg
            $rootScope.uploadError = false;
            $rootScope.$apply();
        }, 5000);
    };

    return {
        process: process
    };

}]);

})();
