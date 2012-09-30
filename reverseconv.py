import jinja2
import os
from numpy import *

import cgi
import webapp2
import datetime
import urllib

from google.appengine.ext import db
from google.appengine.api import users



class reverseconvertible(webapp2.RequestHandler):
    def post(self):
        stockPrice = cgi.escape(self.request.get('stockPrice'))
        intrate = float(cgi.escape(self.request.get('intRate')))
        volsarray = cgi.escape(self.request.get('volminmax'))
        volmin = float(cgi.escape(volsarray.split(",")[0]))
        volmax = float(cgi.escape(volsarray.split(",")[1]))
        coupon = float(cgi.escape(self.request.get('coupon1')))
        mat = float(cgi.escape(self.request.get('mat')))
        kbar = int(cgi.escape(self.request.get('kbar')))
        ds=1
        dt= 1.0/(volmin*volmin*4*100*100)
        NTS = int(mat/dt)
        dummy = 0
        NAS = 200
        S = zeros((NAS))
        vold = zeros((NAS,NTS))
        voldbarrier = zeros((NAS,NTS))
        for i in range(0,NAS):
            S[i] = i * ds
            vold[i][0] = max(100-S[i],0)
            
        vol = volmin
        for k in range(0,NTS-1):
            for i in range(1,NAS-1):
                delta = (vold[i+1][k]-vold[i-1][k])/(2*ds)
                gamma = (vold[i+1][k]+vold[i-1][k]-2*vold[i][k])
                theta = -0.5 * vol * vol *S[i]*S[i] *gamma - intrate * S[i] * delta +intrate*S[i]*delta+intrate*vold[i][k]
                vol = volmin
                vold[i][k+1] = vold[i][k]-dt*theta
            vold[0][k+1] = (1-intrate*dt)*vold[0][k]
            vold[NAS-1][k+1]=2*vold[NAS-2][k+1]-vold[NAS-3][k+1]
        
        for i in range(kbar,NAS):
            voldbarrier[i][0] = max(kbar-i,0)
        
        for k in range(0,NTS-1):
            for i in range(kbar+1,NAS-1):
                delta = (voldbarrier[i+1][k]-voldbarrier[i-1][k])/2/ds
                gamma = (voldbarrier[i+1][k]+voldbarrier[i-1][k]-2*voldbarrier[i][k])/ds/ds
                theta = -0.5 * vol * vol * S[i] * S[i] * gamma - intrate * S[i] * delta + intrate * voldbarrier[i][k]
                voldbarrier[i][k+1] = voldbarrier[i][k] - dt * theta
                
            voldbarrier[kbar][k+1]=vold[kbar][k+1]
            voldbarrier[NAS-1][k+1] = 2*voldbarrier[NAS-2][k+1]-voldbarrier[NAS-3][k+1]
        
        self.response.headers['Content-Type']='application/json'
        self.response.out.write("[")
        
        for i in range(kbar,NAS):
            pval = i * ds
            finalprice = voldbarrier[i][NTS-1]
            cc = (100 + coupon)/((1+intrate)**mat)
            total = cc - finalprice
            self.response.out.write("{Stock: '"+str(pval)+"',OP: '"+str(finalprice)+"',BestCase: '"+str(cc)+"',WorstCase: '"+str(total)+"}'},")
        self.response.out.write("{Stock: 'X',OP: 'X',BestPrice: 'X',WorstPrice: 'X'}]")
                                                   


app = webapp2.WSGIApplication([('/reverseconv/reverseconvertible',reverseconvertible)],debug=True)


