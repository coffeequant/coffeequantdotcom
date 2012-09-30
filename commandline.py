import jinja2
import os
from numpy import *

jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)))

import cgi
import webapp2
import datetime
import urllib

from google.appengine.ext import db
from google.appengine.api import users
from google.appengine.ext.webapp import template


class CommandLine(webapp2.RequestHandler):
    def post(self):
        self.response.out.write("Hello!")

                       
app = webapp2.WSGIApplication([('/commandline', CommandLine)],debug=True)




