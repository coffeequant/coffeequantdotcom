import jinja2
import os
from numpy import *

import cgi
import webapp2
import datetime
import urllib

from google.appengine.ext import db
from google.appengine.api import users



class portfoliograph(webapp2.RequestHandler):
    def post(self):
        graphsetting = cgi.escape(self.request.get('graphsetting'))
        stockPrice = int(cgi.escape(self.request.get('stockPrice')))
        
        volsarray = cgi.escape(self.request.get('volminmax'))
        volmin = float(cgi.escape(volsarray.split(",")[0]))
        volmax = float(cgi.escape(volsarray.split(",")[1]))
        
        intarray = cgi.escape(self.request.get('intrminmax'))
        intmin = float(cgi.escape(intarray.split(",")[0]))
        intmax = float(cgi.escape(intarray.split(",")[1]))
        
        maturities = (cgi.escape(self.request.get('maturity'))).split(',')
        maturities = map(float, maturities)
        maxmat = int(max(maturities))
        
        strikes = (cgi.escape(self.request.get('strikes'))).split(',')
        cps = (cgi.escape(self.request.get('callorputs'))).split(',')
        qts = (cgi.escape(self.request.get('qts'))).split(',')
        
        strikes = map(float, strikes)
        strike = int(max(strikes))
        count = len(maturities)
        
        
        NAS = int(cgi.escape(self.request.get('spotsteps')))
	if(NAS>100):
            NAS = 100
        
        ds = 2 * strike / NAS
        dt = 0.9/(volmax*volmax*NAS*NAS)
        NTS = int(maxmat/dt)
        
        S = zeros((NAS))
        vold = zeros((NAS))
        voldbest = zeros((NAS))
        vnew = zeros((NAS))
        vnewbest = zeros((NAS))
        
        arrdeltabest = zeros((NAS))
        arrdeltaworst = zeros((NAS))
        arrthetaworst = zeros((NAS))
        arrthetabest = zeros((NAS))
        arrgammabest = zeros((NAS))
        arrgammaworst = zeros((NAS))
        
        greekstore = zeros((NAS,NTS))
        
        
        fixingsarray = zeros((count))
        
        for i in range(0,count):
            fixingsarray[i] = int((float(maturities[i])*(NTS)/maxmat))
        
        for i in range(0,NAS):
            S[i] = i * ds
            
        for k in range(0,NTS):
            tempindex = 0
            for fix_c in range(0,count):
                if ((NTS-k) == fixingsarray[tempindex]):
                    if cps[tempindex] == "C":
                        for i in range(0,NAS):
                            vold[i] = vold[i] + float(qts[tempindex])*max(S[i]-float(strikes[tempindex]),0)
                            voldbest[i] = vold[i]
                    if cps[tempindex] == "P":
                        for i in range(0,NAS):
                            vold[i] = vold[i] + float(qts[tempindex])*max(float(strikes[tempindex])-S[i],0)
                            voldbest[i] = vold[i]
                tempindex = tempindex + 1
            
            volused = volmin
            intused = intmin
            
            for i in range(1,NAS-1):
                delta = (vold[i+1]-vold[i-1])/(2*ds)
                arrdeltaworst[i] = delta
                
                gamma = (vold[i+1]+vold[i-1]-2*vold[i])/(ds*ds)
                arrgammaworst[i] = gamma
                
                volused = volmin
                if (gamma > 0):
                    volused = volmax
                
                intused = intmin
                if (vold[i]>0):
                    intused = intmax
                
                theta = -0.5 * volused * volused * S[i] * S[i] * gamma - intused * S[i] * delta + intused * vold[i]
                arrthetaworst[i] = theta
                
                if (graphsetting == "Price"):  
                    greekstore[i][k] = vold[i]
                
                
                if (graphsetting == "DeltaWStock"):
                    greekstore[i][k] = delta
                
                if (graphsetting == "GammaWStock"):
                    greekstore[i][k] = gamma
                
                if (graphsetting == "ThetaWStock"):
                    greekstore[i][k] = theta
                
                
                if (graphsetting == "Delta" and S[i] == stockPrice):
                    greekstore[i][k] = delta
                    
                if (graphsetting == "Gamma" and S[i] == stockPrice):
                    greekstore[i][k] = gamma
                
                if (graphsetting == "Theta" and S[i] == stockPrice):
                    greekstore[i][k] = theta
                
                
                vnew[i] = vold[i] - dt*theta
                
                #best prices
                deltabest = (voldbest[i+1]-voldbest[i-1])/(2*ds)
                arrdeltabest[i]=deltabest
                gammabest = (voldbest[i+1]-2*voldbest[i]+voldbest[i-1])/(ds*ds)
                arrgammabest[i]=gammabest
                volused=volmin
                if (gammabest < 0):
                    volused=volmax
                
                intused = intmin
                
                if (voldbest[i] < 0):
                    intused = intmax
                
                thetabest = -0.5 * volused * volused * S[i] * S[i] * gammabest - intused * S[i] * deltabest + intused * voldbest[i]
                arrthetabest[i]=theta

                vnewbest[i] = voldbest[i] - dt * thetabest
                
                if (graphsetting == "Vega"):
                    greekstore[i][k] = (vnew[i] - vnewbest[i])/(volmax-volmin)
                
                if(graphsetting == "VegaWStock"):
                     greekstore[i][NTS-2] = (vnew[i] - vnewbest[i])/(volmax-volmin)
            
            vnew[0] = vold[0]*(1-intused*dt)
            vnew[NAS-1] = 2*vnew[NAS-2]-vnew[NAS-3]
            
            vnewbest[0] = voldbest[0]*(1-intused*dt)
            vnewbest[NAS-1] = 2*vnewbest[NAS-2]-vnewbest[NAS-3]
            
            for l in range(0,NAS):
                vold[l] = vnew[l]
                voldbest[l] = vnewbest[l]
        
        self.response.headers['Content-Type']='application/json'
        self.response.out.write("stock1:[")
        
        if (graphsetting == "Price" or graphsetting == "DeltaWStock" or graphsetting == "GammaWStock" or graphsetting == "ThetaWStock" or graphsetting == "VegaWStock"):
            for i in range(0,NAS-1):
                finalprice = greekstore[i][NTS-2]
                self.response.out.write(""+str(finalprice)+",")
                
        index_s = int(stockPrice) / int(ds)
        
        if (graphsetting== "Delta" or graphsetting == "Gamma" or graphsetting == "Theta" or graphsetting == "Vega"):
            for i in range(0,NTS-2):
                finalprice = greekstore[index_s][i]
                self.response.out.write(""+str(finalprice)+",")
        
        self.response.out.write("0]")
                

class portfolio(webapp2.RequestHandler):
    def post(self):
        stockPrice = cgi.escape(self.request.get('stockPrice'))
        
        volsarray = cgi.escape(self.request.get('volminmax'))
        volmin = float(cgi.escape(volsarray.split(",")[0]))
        volmax = float(cgi.escape(volsarray.split(",")[1]))
        
        intarray = cgi.escape(self.request.get('intrminmax'))
        intmin = float(cgi.escape(intarray.split(",")[0]))
        intmax = float(cgi.escape(intarray.split(",")[1]))
        
        maturities = (cgi.escape(self.request.get('maturity'))).split(',')
        maturities = map(float,maturities)
        maxmat = int(max(maturities))
        
        strikes = (cgi.escape(self.request.get('strikes'))).split(',')
        cps = (cgi.escape(self.request.get('callorputs'))).split(',')
        qts = (cgi.escape(self.request.get('qts'))).split(',')
        
        strikes = map(float,strikes)
        strike = int(max(strikes))
        count = len(maturities)
        
        
        NAS = int(cgi.escape(self.request.get('spotsteps')))
        
        ds = float(2 * strike / NAS)
        dt = 0.9/(volmax*volmax*NAS*NAS)
        NTS = int(maxmat/dt)
        
        S = zeros((NAS))
        vold = zeros((NAS))
        voldbest = zeros((NAS))
        vnew = zeros((NAS))
        vnewbest = zeros((NAS))
        
        arrdeltabest = zeros((NAS))
        arrdeltaworst = zeros((NAS))
        arrthetaworst = zeros((NAS))
        arrthetabest = zeros((NAS))
        arrgammabest = zeros((NAS))
        arrgammaworst = zeros((NAS))
        
	arrvega = zeros((NAS))        
        tempv = 0
        
        fixingsarray = zeros((count))
        
        for i in range(0,count):
            fixingsarray[i] = int((float(maturities[i])*NTS)/maxmat)
            
        for i in range(0,NAS):
            S[i] = i * ds
        
        for k in range(0,NTS):
            tempindex = 0
            for fix_c in range(0,count):
                if ((NTS-k) == fixingsarray[tempindex]):
                    if cps[tempindex] == "C":
                        for i in range(0,NAS):
                            vold[i] = vold[i] + float(qts[tempindex])*max(S[i]-float(strikes[tempindex]),0)
                            voldbest[i] = vold[i]
                            tempv = vold[NAS-1]
                    if cps[tempindex] == "P":
                        for i in range(0,NAS):
                            vold[i] = vold[i] + float(qts[tempindex])*max(float(strikes[tempindex])-S[i],0)
                            voldbest[i] = vold[i]
                tempindex = tempindex + 1
            
            volused = volmin
            intused = intmin
            
            
            for i in range(1,NAS-1):
                delta = (vold[i+1]-vold[i-1])/(2*ds)
                arrdeltaworst[i] = delta
                
                gamma = (vold[i+1]+vold[i-1]-2*vold[i])/(ds*ds)
                arrgammaworst[i] = gamma
                
                volused = volmin
                if (gamma > 0):
                    volused = volmax
                
                intused = intmin
                if (vold[i]>0):
                    intused = intmax
                
                intused = 0
                theta = -0.5 * volused * volused * S[i] * S[i] * gamma - intused * S[i] * delta + intused * vold[i]
                arrthetaworst[i] = theta
                
                vnew[i] = vold[i] - dt*theta
                
                #best prices
                deltabest = (voldbest[i+1]-voldbest[i-1])/(2*ds)
                arrdeltabest[i]=deltabest
                gammabest = (voldbest[i+1]-2*voldbest[i]+voldbest[i-1])/(ds*ds)
                arrgammabest[i]=gammabest
                volused=volmin
                if (gammabest < 0):
                    volused=volmax
                
                intused = intmin
                
                if (voldbest[i] < 0):
                    intused = intmax
                
                thetabest = -0.5 * volused * volused * S[i] * S[i] * gammabest - intused * S[i] * deltabest + intused * voldbest[i]
                arrthetabest[i]=thetabest

                vnewbest[i] = voldbest[i] - dt * thetabest
            
            vnew[0] = vold[0]*(1-intused*dt)
            vnew[NAS-1] = 2*vnew[NAS-2]-vnew[NAS-3]
            
            vnewbest[0] = voldbest[0]*(1-intused*dt)
            vnewbest[NAS-1] = 2*vnewbest[NAS-2]-vnewbest[NAS-3]
            
            for l in range(0,NAS):
                vold[l] = vnew[l]
                voldbest[l] = vnewbest[l]
        
                        
        
        
        self.response.headers['Content-Type']='application/json'
        self.response.out.write("[")
        
        for i in range(1,NAS):
            self.response.out.write("{ Stock: '"+str(S[i])+"', OPW: '"+str(round(vold[i],5))+"', OPB: '"+str(round(voldbest[i],3))+"', DeltaW: '"+str(round(arrdeltabest[i],3))+"', DeltaB: '"+str(round(arrdeltaworst[i],3))+"',GammaW: '"+str(round(arrgammaworst[i],3))+"',GammaB: '"+str(round(arrgammabest[i],3))+"',ThetaW: '"+str(round(arrthetaworst[i],3))+"',ThetaB: '"+str(round(arrthetabest[i],3))+"' },")
            
        self.response.out.write("{ Stock: '"+ str(strike)+"', OPW: 'X', OPB: 'X', DeltaB: 'X', DeltaW: 'X' , ThetaB: 'X' , ThetaW: 'X' , GammaW: 'X' , GammaB: 'X' }]")
                                                   


app = webapp2.WSGIApplication([('/portfolioanalyzer/portfolio',portfolio),('/portfolioanalyzer/portfoliograph',portfoliograph)],debug=True)


