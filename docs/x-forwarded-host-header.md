# Using the X-Forwarded-Host Header

For use in a multi-site and multi-network WordPress setup, the X-Forwarded-Host header is used to determine the path of the S3 object that is requested by the user. This header is added to the request by the upstream Apache instance that is using mod-proxy to proxy the user request to the signing container.

Apache sets the X-Forwarded-Host header according to the domain name of the original requests. This domain name is used to construct the path of the S3 object by concatenating the domain with the url from the userRequest object.

The multi-network WordPress installation is configured to upload files to S3 using the domain name of the site as the prefix. This ensures that the path of the S3 object is unique across all sites and networks.
