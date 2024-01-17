# Protected media

The Lambda applies access restrictions based on rules determined by records in DynamoDB and by the url of the request. These urls and DynamDB records are managed by the BU Access Control WordPress plugin.

There are two ways to protect media files in this application: individual file protections and whole site protections.

## Individual file protections

By convention, the Lambda function recognizes files with the string `/__restricted/` in the path as being protected, and uses the next path segment as the name of the associated access group to apply. For example, a request for the following URL would be recognized as a request for a protected file:

```text
https://sites.bu.edu/example-site/files/__restricted/example-group/protected-file.pdf
```

The Lambda function would use the site url and the group name to look up the `example-group` access group in the DynamoDB table and apply the access rules to the request. If the user is authorized to access the file, the Lambda function returns the file with a 200 OK response (the standard HTTP response code for a successful request).  If the user is not authorized to access the file, the Lambda function returns a 403 Forbidden response (the standard HTTP respsonse code when access is denied).

## Whole site protections

In addition to individual file protections, the Lambda function can also apply access controls to an entire site. This is useful for sites that need to be completely protected from public access. The list of protected sites are stored in a single DynamoDB item with the key of `PROTECTED_SITES`. The list is a JSON encoded array of key-value pairs, where the key is the url of the site and the value is the name of the access group to be applied.

This is an example of a `PROTECTED_SITES` record:

```json
[
    {
        "https://sites.bu.edu/example-site": "example-group"
    },
    {
        "https://sites.bu.edu/another-example-site": "another-example-group"
    }
]
```

To efficiently apply the access controls for these protected sites, the `PROTCETED_SITES` record is cached by the Lambda function for up to a minute. This means that any changes to the `PROTECTED_SITES` record will not be applied until the cache expires. The Lambda uses a value declared outside of the handler function to store the cache, and the cache is refreshed when the value is empty or expired. This is a standard part of the Lambda execution environment, there is a [good summary blog post about it here](https://katiyarvipinknp.medium.com/how-to-cache-the-data-in-aws-lambda-function-using-node-js-use-tmp-storage-of-aws-lambda-2c7e1e01d923).

## Access control rules

The access control rules are stored in a DynamoDB table, which is created by the CloudFormation template and populated by the BU Access Control WordPress plugin. The access rule records in the table have a composite primary key of `site` and `group`, where the `site` attribute is the url of the site and the `group` attribute is the name of the access group. The two parts of the primary key are combined with a `#` character as a delimiter. For example, the access rule record for the `example-group` access group on the `https://sites.bu.edu/example-site` site would have a primary key of `sites.bu.edu/example-site#example-group`.

Each record has an attribute called `rules` which is a JSON encoded array of access control rules. Each rule is a key-value pair where the key is the name of the rule and the value is the rule data. The following is an example of an access rule record:

```json
{
    "users":["webteam","authorized-user"],
    "states":["faculty"],
    "entitlements":["http:\/\/iam.bu.edu\/hr\/OrgUnitParent\/9999999"],
    "ranges":[],
    "satisfy_all":null,
    "admins":["site-","wrh"]
}
```

The `authorizeRequest()` function is responsible for taking the authentication data from the user request headers and comparing them to the access rules in the DynamoDB table. The function returns `true` if the user is authorized to access the file and `false` if the user is not authorized.
