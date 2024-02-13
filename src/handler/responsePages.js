const notFoundPage = `
<!DOCTYPE html>
<html>
<head>
    <title>404 Not Found</title>
</head>
<body>
    <h1>404 Not Found</h1>
    <p>The page you are looking for could not be found.</p>
</body>
</html>
`;

const forbiddenPage = `
<!DOCTYPE html>
<html>
<head>
    <title>403 Forbidden</title>
</head>
<body>
    <h1>403 Forbidden</h1>
    <p>You are not authorized to access this page.</p>
</body>
</html>
`;

function loginRedirectPage(shibHandler, returnUrl) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>302 Redirect to Log In</title>
    <meta http-equiv="refresh" content="0; URL='${shibHandler}/Login?target=${encodeURIComponent(returnUrl)}'" />
</head>
<body>
    <h1>302 Redirect to Log In</h1>
    <p>
        <a href="${shibHandler}/Login?target=${encodeURIComponent(returnUrl)}">log in to see protected content</a>
    </p>
</body>
</html>`;
}

export { notFoundPage, forbiddenPage, loginRedirectPage };
