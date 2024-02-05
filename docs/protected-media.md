# Protected media

The Lambda function applies access restrictions based on rules determined by records in DynamoDB and by the url of the request. These urls and DynamoDB records are managed by the BU Access Control WordPress plugin.

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

On each request, the Lambda function checks if the site url is in the `PROTECTED_SITES` list. If so, it gets the access group name from the list and uses it to apply the access rules the same as with individual file protections.

## Access control rules

The access control rules are stored in a DynamoDB table, which is created by the CloudFormation template and populated by the BU Access Control WordPress plugin. The access rule records in the table have a composite primary key of `site` and `group`, where the `site` attribute is the url of the site and the `group` attribute is the name of the access group. The two parts of the primary key are combined with a `#` character as a delimiter. For example, the access rule record for the `example-group` access group on the `https://sites.bu.edu/example-site` site would have a primary key of `sites.bu.edu/example-site#example-group`.

Each record has an attribute called `rules` which is a JSON encoded array of access control rules. Each rule is a key-value pair where the key is the name of the rule and the value is the rule data. The following is an example of an access rule record:

```json
{
    "users":["webteam","authorized-user"],
    "states":["faculty"],
    "entitlements":["http:\/\/iam.bu.edu\/hr\/OrgUnitParent\/9999999"],
    "ranges":["crc","bmc"],
    "satisfy_all":null,
    "admins":["site-admin1","site-admin2"],
}
```

The `authorizeRequest()` function is responsible for taking the authentication data from the user request headers and comparing them to the access rules in the DynamoDB table. The function returns `true` if the user is authorized to access the file and `false` if the user is not authorized.

### Network access rules

Access rules can include IP address ranges, such that requests can be allowed or disallowed based on the IP address of the requestor. Each access control record includes a `ranges` attribute, which contains a list of named "ranges" representing a collection of IP address ranges for a given location.

In the example above, the `crc` range represents the IP address ranges for the Charles River Campus, and the `bmc` range represents the IP address ranges for the Boston Medical Campus.

Rather than storing the actual address ranges in the access rules, they are centrally loaded from an AWS Systems Manager Parameter Store parameter. This allows the address ranges to be centrally managed and updated without needing to update the access rules in the DynamoDB table. The Lambda function uses the `ranges` attribute to look up the address ranges from the parameter store and compare them to the IP address of the requestor.

The Lambda function retrieves this parameter when it starts up and caches it in memory for a period of up to 6 hours. This means that any changes to the network address ranges in the SSM parameter will not be applied until the cache expires or the Lambda function is restarted (for example, when a new version is deployed or it has been inactive long enough to be unloaded). This approach reduces the number of calls to the SSM Parameter Store, which can improve performance and reduce costs.

Here is an example of what the SSM parameter might look like:

```json
{
    "crc": [
        { "start": "10.0.0.0", "end": "10.0.0.255" },
        { "start": "10.0.1.0", "end": "10.0.1.255" }
    ],
    "bmc": [
        { "start": "10.1.0.0", "end": "10.1.0.255" },
        { "start": "10.1.1.0", "end": "10.1.1.255" }
    ]
}
```

In this example, each named range (like "crc" or "bmc") is associated with an array of IP address ranges. Each IP address range is represented by a start and end IP address. When the Lambda function checks the "ranges" rule in an access control record, it looks up the corresponding network ranges in the cached SSM parameter and checks if the IP address of the request falls within any of the ranges. If it does, the request is considered to match the "ranges" rule.

#### SSM parameter details

The SSM parameter is defined in the SAM template with a name based on the stack name and then `/NetworkRanges`. It is a `String` type parameter, and the value consists of a JSON encoded object with the named ranges as keys and the list of IP address ranges as values. The Object Lambda function gets a reference to the name of the SSM parameter from the environment variables and uses the AWS SDK to get the parameter value. The Lambda gets permission to read the parameter from a policy statement in the SAM template.

The IAM user defined in the template is also granted read and write access to the SSM parameter in the SAM template. This means that the IAM user can initialize and update the SSM parameter with new network ranges as needed. At Boston University, there is a WP-CLI command that can be used to update the SSM parameter with the current network ranges defined in the BU Access Control Plugin. The command is:

```bash
wp access update-network-ranges
```
