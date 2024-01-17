# Lambda Function Description

The Lambda function is responsible for authorizing requests to the access point and generating and resized versions of original media.

The code includes the following modules:

* authorizeRequest: A module that checks if a user is authorized to access an object in S3 based on the user's IP address and the site rules defined in DynamoDB.
* getOrCreateObject: A module that retrieves an object from S3 or creates scaled version of the object if it doesn't exist.

The Lambda function (`app.js`) receives the details of the request from the event parameter, which contains the information for the native S3 WriteGetObjectResponse request. It first checks if the request is for a site on the protected sites list. It uses that information, combined with the path of the request to determine if the request is for a protected object. For protected objects, it runs the authorizeRequest module to check if the user is authorized to access the object.

If the user is authorized or the object is unprotected, the `getOrCreateObject()` function retrieves the object from S3 or creates a sized version of the object if it doesn't exist. Finally, the Lambda function returns the image data with a 200 OK response or a 404 Not Found response if the image is not found.

## S3 Object Lambda Pre-signed keys

In typical usage, S3 Object Lambdas do not need direct read or write access to the S3 bucket. This is because the request event that the Lambda function receives contains a pre-signed that allows one-time read access directly without the need for additional credentials.

In our case with image resizing involved, the original request may be rewritted for a different location (sized media are stored in a different location than original media for example). Also the scaled media object may not yet exist. For these reasons, we side-step the pre-signed key and use the AWS SDK to get the object directly from S3, at the potentially rewritten location. The Lambda is also granted write access to the bucket, so that it can save the scaled media object if it doesn't exist. These extra permissions are added as a policy (`S3CrudPolicy`) to the ObjectLambdaFunction in the SAM template.
