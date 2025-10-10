import jinja2
import os
from numpy import *

import cgi
import webapp2
import datetime
import urllib

from google.appengine.ext import db
from google.appengine.api import users

class statichedge(webapp2.RequestHandler):
    def post(self):
        stockPrice = int(cgi.escape(self.request.get('stockPrice')))
        intRate = float(cgi.escape(self.request.get('intRate')))
        strike = float(cgi.escape(self.request.get('strike')))
        
        volsarray = cgi.escape(self.request.get('volminmax'))
        volmin = float(cgi.escape(volsarray.split(",")[0]))
        volmax = float(cgi.escape(volsarray.split(",")[1]))
        
        mat = float(cgi.escape(self.request.get('mat')))
        NAS = int(cgi.escape(self.request.get('spotsteps')))
        
        if (NAS>200):
            NAS = 200
        
        cp = (cgi.escape(self.request.get('cp')))
        #static hedging params - start
        bids = cgi.escape(self.request.get('bids')).split(",")
        asks = cgi.escape(self.request.get('asks')).split(",")
        strikes = cgi.escape(self.request.get('strikes')).split(",")
        cps = cgi.escape(self.request.get('callorputs')).split(",")
        qts = cgi.escape(self.request.get('qts')).split(",")
        
        bids = map(float, bids)
        asks = map(float,asks)
        strikes = map(float,strikes)
        qts = map(float,qts)
        
        S = zeros((NAS))
        vold = zeros((NAS))
        vnew = zeros((NAS))
        vnewbuy = zeros((NAS))
        voldbuy = zeros((NAS))
        payoff = zeros((NAS))
        dummy = zeros((NAS))
        
        ds = 2*strike/NAS
        dt = 0.9/(volmin*volmin*NAS*NAS)
        NTS = int(mat/dt)
        buy = 0.0
        sell = 0.0
        
        
        for i in range(0,len(bids)):
            if (qts[i]<0):
                sell = sell + qts[i] * bids[i]
                buy = buy + (-1*qts[i] * asks[i])
            if (qts[i]>0):
                sell = sell + qts[i] * asks[i]
                buy = buy + (-1*qts[i] * bids[i])
        
        for i in range(0,NAS):
            S[i] = i *ds
            for tempindex in range(0,len(bids)):
                if (cps[tempindex] == "C"):
                    vold[i] = vold[i] + qts[tempindex]*max(S[i]-strikes[tempindex],0)
                if (cps[tempindex] != "C"):
                    vold[i] = vold[i] + qts[tempindex] * max(strikes[tempindex] - S[i],0)
            
            if(cp == "1"):
                vold[i] = -1*max(S[i]-strike,0)+vold[i]
            else:
                vold[i] = -1*max(strike - S[i],0)
            
            voldbuy[i] = -1*vold[i]
            
        volused = 0.0
        volusedbuy = 0.0
        
        for k in range(1,NTS):
            for i in range(1,NAS-1):
                delta = (vold[i+1]-vold[i-1])/(2*ds)
                gamma = (vold[i+1]-2*vold[i]+vold[i-1])/(ds*ds)
                volused = volmin
                
                if(gamma < 0):
                    volused = volmax

                theta = -0.5 * volused * volused * S[i] * S[i] * gamma - intRate * S[i] * delta + intRate * vold[i]
                vnew[i] = vold[i] - dt * theta

                #Buy Section
                deltabuy = (voldbuy[i+1]-voldbuy[i-1])/2/ds
                gammabuy = (voldbuy[i+1]-2*voldbuy[i]+voldbuy[i-1])/(ds*ds)
                volusedbuy = volmin
                if(gammabuy < 0):
                    volusedbuy = volmax
                
                thetabuy = -0.5 * volusedbuy * volusedbuy * S[i] * S[i] * gammabuy - intRate * S[i] * deltabuy + intRate * voldbuy[i]
                vnewbuy[i] = voldbuy[i] - dt * thetabuy
                
            vnew[0] = vold[0]*(1-intRate*dt)
            vnew[NAS-1]=2*vnew[NAS-2]-vnew[NAS-3]
            vnewbuy[0] = voldbuy[0]*(1- intRate*dt)
            vnewbuy[NAS-1] = 2*vnewbuy[NAS-2]-vnewbuy[NAS-3]
            
            for i in range(0,NAS):
                vold[i] = vnew[i]
                voldbuy[i] = vnewbuy[i]
            
        self.response.headers['Content-Type']='application/json'
        self.response.out.write("[")
        hedged = sell - vnew[int(stockPrice/ds)]
        hedgedbuy = buy - vnewbuy[int(stockPrice/ds)]
        self.response.out.write("{Sell: '"+str(hedged)+"', Buy: '" + str(hedgedbuy)+"'},")
        self.response.out.write("{Sell:'I sold the Call/Put',Buy:'-ve Sign just indicates outflow of Cash for Buying'}]")
                    
                
class fd(webapp2.RequestHandler):
    def post(self):
        stockPrice = int(cgi.escape(self.request.get('stockPrice')))
        intRate = float(cgi.escape(self.request.get('intRate')))
        strike = float(cgi.escape(self.request.get('strike')))
        volsarray = cgi.escape(self.request.get('volminmax'))
        volmin = float(cgi.escape(volsarray.split(",")[0]))
        volmax = float(cgi.escape(volsarray.split(",")[1]))
        
        mat = float(cgi.escape(self.request.get('mat')))
        NAS = int(cgi.escape(self.request.get('spotsteps')))
        
        if(NAS > 200):
            NAS = 200
        
        cp = (cgi.escape(self.request.get('cp')))
        S = zeros((NAS))
        payoff = zeros((NAS))
        vold = zeros((NAS))
        vnew = zeros((NAS))
        dummy = zeros((NAS,10))
        ds = 2 * strike / NAS
        dt = 0.9/(volmin*volmin*NAS*NAS)
        NTS = int(mat/dt)
        for i in range(0,NAS):
            S[i] = i*ds
            S[i] = i * ds
            vold[i] = max(strike - S[i],0)
            if(cp == "1"):
                vold[i] = max(S[i]-strike,0)
            payoff[i] = vold[i]
            dummy[i][1] = S[i]
            dummy[i][2] = payoff[i]
            
        for k in range(1,NTS):
            for i in range(1,NAS-1):
                delta = (vold[i+1]-vold[i-1])/(2*ds)
                gamma = (vold[i+1]-2*vold[i]+vold[i-1])/(ds*ds)
                theta = -0.5 * volmin * volmin * S[i] * S[i] * gamma - intRate * S[i] * delta + intRate * vold[i]
                vnew[i] = vold[i] - dt * theta
                
            vnew[0] = vold[0] * ( 1 - intRate * dt)
            vnew[NAS-1] = 2 * vnew[NAS-2] - vnew[NAS - 3]

            for i in range(0,NAS):
                vold[i] = vnew[i]
            
        for i in range(1,NAS-1):
            dummy[i][3]  = vold[i]
            dummy[i][4] = (vold[i+1]-vold[i-1])/(2*ds)
            dummy[i][5] = (vold[i+1]-2*vold[i]+vold[i-1])/(ds*ds)
            dummy[i][6] = -0.5 * volmin * volmin * S[i] * S[i] * gamma - intRate * S[i] * delta + intRate * vold[i]
            
        dummy[0][3] = vold[0]
        dummy[NAS-1][3] = vold[NAS-1]
        dummy[0][4] = (vold[1]-vold[0])/ds
        dummy[NAS-1][4] = (vold[NAS-1]-vold[NAS-2])/ds
        dummy[0][5] = 0
        dummy[NAS-1][5] = 0
        dummy[0][6] = intRate * vold[0]
        dummy[NAS-1][6] = -0.5 * volmin * volmin * S[NAS-1] * S[NAS-1] * dummy[NAS-1][5] - intRate * S[NAS-1] * dummy[NAS-1][4] + intRate * vold[NAS-1]
        self.response.headers['Content-Type']='application/json'
        self.response.out.write("[")
        for i in range(1,NAS-1):
            self.response.out.write("{ Stock: '"+str(dummy[i][1])+"', OP: '"+str(dummy[i][3])+"', Delta: '"+str(dummy[i][4])+"', Gamma: '"+str(dummy[i][5])+"', Theta: '"+str(dummy[i][6])+"' },")

        self.response.out.write("{ Stock: 'X', OP: 'X', Delta: 'X', Gamma: 'X', Theta: 'X' }]")


class fdgraph(webapp2.RequestHandler):
    def post(self):
        a = 2


app = webapp2.WSGIApplication([('/pricer/fd',fd),('/pricer/fdgraph',fdgraph),('/pricer/statichedge',statichedge)],debug=True)
