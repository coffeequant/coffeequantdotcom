import jinja2
import os
from numpy import *
from math import *
import cgi
import webapp2
import datetime
import urllib

from google.appengine.ext import db
from google.appengine.api import users

class basketpricer(webapp2.RequestHandler):
    def post(self):
        intRate = float(cgi.escape(self.request.get('intRate')))
        strike = int(cgi.escape(self.request.get('strike')))
        strike1 = int(cgi.escape(self.request.get('strike1')))
        strike2 = int(cgi.escape(self.request.get('strike2')))
        
        volsarray = cgi.escape(self.request.get('volminmax'))
        volmin = float(cgi.escape(volsarray.split(",")[0]))
        volmax = float(cgi.escape(volsarray.split(",")[1]))
        
        correlarray = cgi.escape(self.request.get('correlminmax'))
        correlmin = float(cgi.escape(correlarray.split(",")[0]))
        correlmax = float(cgi.escape(correlarray.split(",")[1]))
        
        baskettype = (cgi.escape(self.request.get('optiontypes')))
        scenariotype = (cgi.escape(self.request.get('payoffs')))
        mat = float(cgi.escape(self.request.get('mat')))
        S1max = int(cgi.escape(self.request.get('spotsteps')))
        S2max = int(cgi.escape(self.request.get('spotsteps')))
        
        if(S1max > 50):
            S1max = 50
            S2max = 50
        
        dt = 0.9/(S1max*S1max*volmin*volmin*4)
        
        S1 = zeros((S1max))
        S2 = zeros((S2max))
        
        vold = zeros((S1max,S2max))
        vnew = zeros((S1max,S2max))
        
        
        payoff = zeros((S1max))
        
        div1 = (cgi.escape(self.request.get('div1')))
        div2 = (cgi.escape(self.request.get('div2')))
        
        ds1 = 2*strike/S1max
        ds2 = 2*strike/S2max
        N = int(mat/dt)
        dt = mat/N
        fp = 223
        for i in range(0,S1max):
            S1[i] = i*ds1
            S2[i] = i*ds2
        
        for i in range(0,S1max):
            for j in range(0,S2max):
                if(baskettype == "OtherAsset"):
                    if(S1[i] >= strike1):
                        vold[i][j] = max(S2[j]-strike2,0)
                if(baskettype == "MaxofCall"):
                    vold[i][j] = max(max(S1[i],S2[j])-strike,0)
                    fp = 334
                    
                if(baskettype == "MinofCall"):
                    vold[i][j] = max(min(S1[i],S2[j])-strike,0)
                    
                if(baskettype == "MaxofPut"):
                    vold[i][j] = max(strike - max(S1[i],S2[j]),0)
                
                if(baskettype == "MinofPut"):
                    vold[i][j] = max(strike - min(S1[i],S2[j]),0)

                if(baskettype == "BestofCall"):
                    vold[i][j] = max(max(S1[i]-strike1,0),max(S2[j]-strike2,0))
                    
                    
                if(baskettype == "WorstofCall"):
                    vold[i][j] = min(max(S1[i]-strike1,0),max(S2[j]-strike2,0))

                if(baskettype == "BestofPut"):
                    vold[i][j] = max(max(strike1 - S1[i],0),max(strike2 - S2[j],0))
                    
                if(baskettype == "WorstofPut"):
                    vold[i][j] = min(max(strike1 - S1[i],0),max(strike2 - S2[j],0))
                    
                
        
        
        vol = volmin
        rho = correlmin
        
        for k in range(1,N):
            for i in range(1,S1max-1):
                for j in range(1,S2max-1):
                    delta1 = (vold[i+1][j]-vold[i-1][j])/(2*ds1)
                    gamma1 = (vold[i+1][j]-2*vold[i][j]+vold[i-1][j])/(ds1*ds1)
                    
                    delta2 = (vold[i][j+1]-vold[i][j-1])/(2*ds2)
                    gamma2 = (vold[i][j+1]-2*vold[i][j]+vold[i][j-1])/(ds2*ds2)
                    
                    xgamma = (vold[i+1][j+1] - vold[i+1][j-1] - vold[i-1][j+1] + vold[i-1][j-1])/(4* ds1 * ds2)
                    rho = correlmin
                    
                    if(scenariotype == "CorrelScenario1"):
                        if(xgamma > 0):
                            rho = correlmax
                        
                        if(scenariotype == "CorrelScenario2"):
                            if(xgamma < 0):
                                rho = correlmax
                                
                        vol = volmin
                        if(scenariotype == "VolatilityScenario1"):
                            if(gamma1 > 0 or gamma2 > 0):
                                vol = volmax 

                        if(scenariotype == "VolatilityScenario2"):
                            if(gamma1 < 0 or gamma2 < 0):
                                vol = volmax 
                                
                        theta = 0.5 * vol * vol * S1[i] * S1[i] * gamma1 + 0.5 * vol * vol * S2[j] * S2[j] * gamma2 + (intRate-div1) * S1[i] * delta1 + (intRate-div2) * S2[j] * delta2 - intRate * vold[i][j] + xgamma * vol*vol*S1[i] * S2[j] * rho
                        vnew[i][j] = vold[i][j] + dt * theta
            for j in range(0,S1max):
                vnew[S1max-1][j] = 2 * vnew[S1max-2][j] - vnew[S1max-3][j]
            
            for j in range(0,S1max):
                vnew[j][S1max-1] = 2 * vnew[j][S1max-2] - vnew[j][S1max-3]
                
            for j in range(0,S1max):
                vnew[0][j] = vold[0][j]*(1-intRate*dt)

            for j in range(0,S1max):
                vnew[j][0] = vold[j][0]*(1-intRate*dt)
        
            for i in range(0,S1max):
                for j in range(0,S1max):
                    vold[i][j] = vnew[i][j]
                    
        self.response.headers['Content-Type']='application/json'
        self.response.out.write("[[")
        self.response.out.write("{name: 'Row', field: 'id'},")
        for j in range(0,S1max):
            tmp2 = j * ds1
            if(j==0):
                self.response.out.write("{ name: 'S1 / S2 -->', field: '"+str(j)+"',formatter: formatGrid },")
            elif(j == S1max-1):
                self.response.out.write("{ name: '"+str(tmp2)+"', field: '"+str(j)+"',formatter: formatGrid }")
            else:
                self.response.out.write("{ name: '"+str(tmp2)+"', field: '"+str(j)+"',formatter: formatGrid },")
        
        self.response.out.write("]]|[")
        
        for i in range(0,S1max):
            self.response.out.write("{")
            for j in range(0,S2max):
                vold[i][j] = vnew[i][j]
                tmp1 = i * ds1
                tmp2 = j * ds2
                if(j==0):
                    self.response.out.write(str(j)+": '"+str(tmp1)+"',")
                    
                elif(j==S2max-1):
                    self.response.out.write(str(j)+": '"+str(vold[i][j])+"'")
                else:
                    self.response.out.write(str(j)+": '"+str(vold[i][j])+"',")
                    
            self.response.out.write("},")
        
        self.response.out.write("{ Stock: 'X', OP: 'X', Delta: 'X'}")
        self.response.out.write("]")
        
        
app = webapp2.WSGIApplication([('/baskets/basketpricer',basketpricer)],debug=True)


