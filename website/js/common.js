// File means the image file which you uploaded.
// "file_labels" records the labels which detect from the image by Amazon Rekognition.
var file = '';
var file_type = '';
var file_key = '';
var file_labels = new Array();

// Login aws as an unauth cognito role.
// Besides, you can rewrite this function to make sure that the end users must login by Amazon account or other account (By user name
// and password), using auth cognito instead of unauth cognito.
function Unauthenticated_Login() {
	AWS.config.region = AWS_REGION;
	
	AWS.config.credentials = new AWS.CognitoIdentityCredentials({
		IdentityPoolId: AWS_COGNITO_POOL_ID,
	});

	AWS.config.credentials.get(function(){
		var accessKeyId = AWS.config.credentials.accessKeyId;
		var secretAccessKey = AWS.config.credentials.secretAccessKey;
		var sessionToken = AWS.config.credentials.sessionToken;
	});
}

// Change file data to blob.
function dataURItoBlob(dataURI) {
	var byteString = atob(dataURI.split(',')[1]);

	var ab = new ArrayBuffer(byteString.length);
	var ia = new Uint8Array(ab);
	for (var i = 0; i < byteString.length; i++) {
		ia[i] = byteString.charCodeAt(i);
	}

	return ab;
}

//  Get random string as S3 image object name.
function randomString(len) {
　　len = len || 32;
　　var $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
　　var maxPos = $chars.length;
　　var pwd = '';
　　for (i = 0; i < len; i++) {
　　　　pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
　　}
　　return pwd;
}

// Transfer array to string.
function arrayToString(arr) {
	var len = arr.length;
  　var tree = "[";
	for (var i = 0; i < len; i++) {
   　　　tree += "[";
   　　　tree += "'" + arr[i][0] + "',";
   　　　tree += "'" + arr[i][1] + "'";
  　　　 tree += "]";
  　　　 if (i < len - 1) {
    　　 　　tree += ",";
 　　　  }
  　 }
  　 tree += "]";
  　 return tree;
}

// Detect and upload photos.
function Detect_And_Upload_Photos(obj) {
	var image_type = new Array('gif', 'jpeg', 'png', 'jpg', 'bmp');

	// Check image content, size and type.
	if (obj.value == '') {
		alert("Please upload the photo.");
		return false;
	} else {
		var fileContentType = obj.value.match(/^(.*)(\.)(.{1,8})$/)[3];
		var objValue = obj.value;

		try {
			var fso = new ActiveXObject("Scripting.FileSystemObject");
			fileLenth = parseInt(fso.getFile(objValue).size);
		} catch (e) {
			try {
				fileLenth = parseInt(obj.files[0].size);
			} catch (e) {
				return false;
			}
		}

		if (fileLenth > MAX_FILE_LENGTH) {
			alert("You can only upload photo less than " + MAX_FILE_LENGTH + " B.");
			obj.value = '';
			return false;
		}

		for (var i in image_type) {
			if (fileContentType.toLowerCase() == image_type[i].toLowerCase()) {
				file = obj.files[0];
				file_type = fileContentType.toLowerCase();
			}
		}

		if (file == '') {
			alert("The photo you uploaded is not in the correct format. Please choose another one!");
			obj.value = '';
			return false;
		}
	}
	
	console.log(file);

	// Detect image moderation.
	Detect_Image_Moderation();
}


// Detect image moderation.
// You can complete the following code by yourself. Or copy the default code.
function Detect_Image_Moderation() {
	var modal = document.getElementsByClassName("modal");
	modal[0].style.display = "block";

	var reader = new FileReader();

	reader.onload = function () {
		var rekognition = new AWS.Rekognition();
		
		// Your code here.
        // Part 1. Detect explicit or suggestive adult content. You can use "MODERATION_MIN_CONFIDENCE" as confidence setting.
        // After you get data from Amazon Rekognition successfully, you should call "Upload_Photos" function to upload the image.

        // Part 2. Detect image labels and store the labels and confidence in the array "file_labels".
        // You can use "MAX_LABELS" as maximum labels setting, and "LABELS_MIN_CONFIDENCE" as confidence setting.
        // Do not forget to empty the array "file_labels" and push items like [label_name, label_confidence] in the array "file_labels".
	}
	reader.readAsDataURL(file);
}

// Upload photos after detected.
function Upload_Photos() {
	var S3 = new AWS.S3();
	var current_time = new Date();
	file_key = "photos/" + current_time.getUTCFullYear() + "/" + (current_time.getUTCMonth() + 1) + "/" + current_time.getUTCDate() + "/" + randomString(16) + "." + file_type;

	var params = {
		Bucket: AWS_BUCKET_NAME,
		Key: file_key,
		Body: file
	};

	S3.upload(params, function(err, data) {
		if (err == null) {
			Post_To_ES();
		} else {
			console.log(err);
			var modal = document.getElementsByClassName("modal");
			modal[0].style.display = "none";
			alert("Something failure during photo uploading, please try it again later.");
		}
	});
}

// Post photos information to Elasticsearch.
function Post_To_ES() {
	var data = {
		"photo_key": file_key,
		"photo_time": (Date.parse(new Date()) / 1000),
		"photo_labels": arrayToString(file_labels)
	};

	var obj = new XMLHttpRequest();
    obj.open("POST", AWS_ES_ENDPOINT + "/photos/user1", true);
    obj.setRequestHeader("Content-type", "application/json");
	
	obj.onreadystatechange = function() {
    	if (obj.readyState == 4 && (obj.status == 200 || obj.status == 304 || obj.status == 201)) {
			var modal = document.getElementsByClassName("modal");
			modal[0].style.display = "none";
			alert("Upload successfully!");
        }
    };
    obj.send(JSON.stringify(data));
}

// Show photos by searching from Elasticsearch.
function Show_Photos(search_key) {
	var obj = new XMLHttpRequest();
	if (search_key == '') {
		obj.open('GET', AWS_ES_ENDPOINT + "/photos/user1/_search", true);
		obj.setRequestHeader("Content-type", "application/json");
	} else {
		obj.open('GET', AWS_ES_ENDPOINT + "/photos/user1/_search?q=" + search_key, true);
		obj.setRequestHeader("Content-type", "application/json");
	}

	obj.onreadystatechange = function() {
		if (obj.readyState == 4 && (obj.status == 200 || obj.status == 304 || obj.status == 201)) {
			var photos_data = new Array();
			var responseJson = eval("(" + obj.responseText + ")");

			for (var i = 0; i < responseJson.hits.total; i++) {
				photos_data.push(responseJson.hits.hits[i]._source);
			}

			var photos_list = document.getElementById("photos-list");
			var photos_module = document.getElementById("photos-module");
			var photos_module_line = document.getElementById("photos-module-line");

			photos_module.removeChild(photos_list);
			photos_module.removeChild(photos_module_line);
			photos_list = document.createElement("div");
			photos_list.className = "photos-list col-md-12";
			photos_list.setAttribute("id", "photos-list");

			for (var i = 0; i < photos_data.length; i++) {
				photo_block = Draw_Photo(photos_data[i]);
				photos_list.appendChild(photo_block);
			}

			if (responseJson.hits.total == 0) {
				photos_list = document.createElement("div");
				photos_list.className = "photos-list col-md-12";
				photos_list.setAttribute("id", "photos-list");

				photos_list_p = document.createElement("p");
				photos_list_text = document.createTextNode("We can not find any matching photos.");

				photos_list_p.appendChild(photos_list_text);
				photos_list.appendChild(photos_list_p);
			}

			photos_module.appendChild(photos_list);
			photos_module.appendChild(photos_module_line);
		} else if (obj.readyState == 4 && (obj.status == 404)) {
			var photos_list = document.getElementById("photos-list");
			var photos_module = document.getElementById("photos-module");
			var photos_module_line = document.getElementById("photos-module-line");

			photos_module.removeChild(photos_list);
			photos_module.removeChild(photos_module_line);
			photos_list = document.createElement("div");
			photos_list.className = "photos-list col-md-12";
			photos_list.setAttribute("id", "photos-list");

			photos_list_p = document.createElement("p");
			photos_list_text = document.createTextNode("We can not find any matching photos.");

			photos_list_p.appendChild(photos_list_text);
			photos_list.appendChild(photos_list_p);

			photos_module.appendChild(photos_list);
			photos_module.appendChild(photos_module_line);
		}
	};
	obj.send();
}

// Draw one photo in the web.
function Draw_Photo(data) {
	var image_height = (document.getElementById("photos-module").offsetWidth - 60) / 4 - 30;

	var photo_block = document.createElement("div");
	photo_block.className = "photo-block col-lg-3";
	
	var photo_image = document.createElement("div");
	photo_image.className = "photo-image";
	// TODO: us-east-1 should be handled specially.
	photo_image.setAttribute("style", "background-repeat:no-repeat; background-size:contain;-moz-background-size:contain;height:" + image_height + "px;margin-top:10px;");

	var img = new Image();
	img.onload = function () {
		photo_image.style.backgroundImage = 'url(' + img.src + ')';

		if (img.width > img.height) {
			photo_image.style.marginTop = (Math.round((image_height - img.height * image_height / img.width) / 2) + 10) + "px";
			photo_image.style.height = (image_height - Math.round((image_height - img.height * image_height / img.width) / 2)) + "px";
		} else if (img.width < img.height) {
			photo_image.style.marginLeft = Math.round((image_height - img.width * image_height / img.height) / 2) + "px";
		}
	}
	if (AWS_REGION == "us-east-1") {
		img.src = "https://s3" + ".amazonaws.com/" + AWS_BUCKET_NAME + "/" + data.photo_key;
	} else {
		img.src = "https://s3-" + AWS_REGION + ".amazonaws.com/" + AWS_BUCKET_NAME + "/" + data.photo_key;
	}

	var photo_labels = document.createElement("div");
	photo_labels.className = "photo-labels";

	var data_labels = eval(data.photo_labels);

    // Photo label color setting. You can change the color setting as you want.
	for (var i = 0; i < data_labels.length; i++) {
		photo_label = document.createElement("span");
		photo_label_text = document.createTextNode(data_labels[i][0]);

		if (data_labels[i][1] > 90) {
			photo_label.className = "photo-label label label-danger";
		} else if (data_labels[i][1] > 80) {
			photo_label.className = "photo-label label label-warning";
		} else if (data_labels[i][1] > 70) {
			photo_label.className = "photo-label label label-info";
		} else if (data_labels[i][1] > 60) {
			photo_label.className = "photo-label label label-success";
		} else if (data_labels[i][1] > 50) {
			photo_label.className = "photo-label label label-primary";
		} else {
			photo_label.className = "photo-label label label-default";
		}

		photo_label.appendChild(photo_label_text);
		photo_labels.appendChild(photo_label);
	}

	photo_block.appendChild(photo_image);
	photo_block.appendChild(photo_labels);

	return photo_block;
}

// Search photos by labels.
function Search_Photos() {
	var search_key = document.getElementById("photos-search-input").value;
	Show_Photos(search_key);
}

// Get keyboard input.
function Get_Key(evt) {
	evt = (evt) ? evt : ((window.event) ? window.event : "");
	var key = evt.keyCode ? evt.keyCode : evt.which;

	if (key == 13) {
		Search_Photos();
	}
}

// Load Demo Photos for testing.
function Load_Demo_Photos() {
	alert("This function has not been on-line, coming soon ...");
}

Unauthenticated_Login();
Show_Photos('');

