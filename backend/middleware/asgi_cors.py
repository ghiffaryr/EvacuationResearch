import falcon

class CORSMiddleware:
    """ASGI-compatible CORS middleware for Falcon."""
    
    def __init__(self, allow_origins=None, allow_all_origins=False, allow_all_headers=False, allow_all_methods=False):
        self.allow_origins = allow_origins or []
        self.allow_all_origins = allow_all_origins
        self.allow_credentials = True
        self.allow_all_headers = allow_all_headers
        self.allow_all_methods = allow_all_methods
        self.allowed_headers = ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
        self.allowed_methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    
    async def process_request(self, req, resp):
        """Handle CORS preflight requests."""
        origin = req.headers.get('ORIGIN', req.headers.get('origin', ''))
        
        # Skip if no origin header or origin is not allowed
        if not origin or (not self.allow_all_origins and origin not in self.allow_origins):
            return
        
        # Set CORS headers
        resp.set_header('Access-Control-Allow-Origin', '*' if self.allow_all_origins else origin)
        
        if self.allow_credentials:
            resp.set_header('Access-Control-Allow-Credentials', 'true')
        
        # Handle preflight OPTIONS request
        if req.method == 'OPTIONS':
            resp.set_header(
                'Access-Control-Allow-Methods',
                ', '.join(self.allowed_methods) if not self.allow_all_methods else '*'
            )
            
            requested_headers = req.headers.get(
                'ACCESS-CONTROL-REQUEST-HEADERS',
                req.headers.get('access-control-request-headers', '')
            )
            
            if self.allow_all_headers:
                resp.set_header('Access-Control-Allow-Headers', requested_headers or '*')
            else:
                resp.set_header('Access-Control-Allow-Headers', ', '.join(self.allowed_headers))
            
            # Set max age to 24 hours
            resp.set_header('Access-Control-Max-Age', '86400')
            
            # No content response for OPTIONS
            resp.status = falcon.HTTP_204
            resp.text = ''
