# Lambda Function Description

The Lambda function is responsible for authorizing requests to the access point and generating and resized versions of original media.

The code includes the following modules:

* authorizeRequest: A module that checks if a user is authorized to access an object in S3 based on the user's IP address and the site rules defined in DynamoDB.
* getOrCreateObject: A module that retrieves an object from S3 or creates scaled version of the object if it doesn't exist.

The Lambda function (`app.js`) receives the details of the request from the event parameter, which contains the information for the native S3 WriteGetObjectResponse request. It first checks if the request is for a site on the protected sites list. It uses that information, combined with the path of the request to determine if the request is for a protected object. For protected objects, it runs the authorizeRequest module to check if the user is authorized to access the object.

If the user is authorized or the object is unprotected, the `getOrCreateObject()` function retrieves the object from S3 or creates a sized version of the object if it doesn't exist. Finally, the Lambda function returns the image data with a 200 OK response or a 404 Not Found response if the image is not found.
