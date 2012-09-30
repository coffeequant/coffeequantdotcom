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

def erfcc(x):
    z = abs(x)
    t = 1. / (1. + 0.5*z)
    r = t * exp(-z*z-1.26551223+t*(1.00002368+t*(.37409196+
    t*(.09678418+t*(-.18628806+t*(.27886807+
    t*(-1.13520398+t*(1.48851587+t*(-.82215223+
    t*.17087277)))))))))
    if (x >= 0.):
        return r
    else:
        return 2. - r
def normcdf(x):
    mu = 0
    sigma = 1
    t = x-mu
    y = 0.5*erfcc(-t/(sigma*sqrt(2.0)))
    if y>1.0:
        y = 1.0
    return y

def x1calc(spot,strike,maturity,vol,mu):
    result = log(spot/strike)/(vol*(maturity**0.5))+(1+mu)*vol*(maturity**0.5)
    return result

def x2calc(spot,barrier,maturity,vol,mu):
    result = log(spot/barrier)/(vol*(maturity**0.5))+(1+mu)*vol*(maturity**0.5)
    return result
    
def y1calc(spot,barrier,strike,vol,maturity,div,rate):
    mu = mucalc(rate,vol,div)
    result = log(barrier*barrier/(spot*strike))/(vol*(maturity**0.5)) + (1+mu)*vol*(maturity**0.5)
    return result

def y2calc(spot,barrier,mu,vol,maturity,div,rate):
    mu = mucalc(rate,vol,div)
    result = log(barrier/spot)/(vol*(maturity**0.5))+(1+mu)*(vol*(maturity**0.5))
    return result

def zcalc(spot,barrier,lambda1,vol,maturity):
    result = log(barrier/spot)/(vol*(maturity**0.5))+lambda1*vol*(maturity**0.5)
    return result

def mucalc(rate,vol,div):
    result = (rate-div+vol*vol*0.5)/(vol*vol)
    return result

def lambdacalc(mu,rate,vol):
    result = (mu*mu+2*rate/(vol*vol))**0.5
    return result
    
def Acalc(phi,spot,strike,barrier,rate,div,maturity,vol):
    mu = mucalc(rate,vol,div)
    x1 = x1calc(spot,strike,maturity,vol,mu)
    result = phi*spot*exp((rate-div-rate)*maturity)*normcdf(phi*x1)-phi*strike*exp(-rate*maturity)*normcdf(phi*x1-phi*vol*(maturity**0.5))
    return result

def Bcalc(phi,spot,strike,barrier,rate,div,maturity,vol):
    mu = mucalc(rate,vol,div)
    x2 = x2calc(spot,barrier,maturity,vol,mu)
    result = phi*spot*exp((rate-div-rate)*maturity)*normcdf(phi*x2)-phi*strike*exp(-rate*maturity)*normcdf(phi*x2-phi*vol*(maturity**0.5))
    return result

def Ccalc(phi,eta,spot,strike,barrier,rate,div,maturity,vol):
    y1 = y1calc(spot,barrier,strike,vol,maturity,div,rate)
    mu = mucalc(rate,vol,div)
    result = phi*spot*exp((rate-div-rate)*maturity)*((barrier/spot)**(2*(mu+1)))*normcdf(eta*y1)-phi*strike*exp(-rate*maturity)*((barrier/spot)**(2*mu))*normcdf(eta*y1-eta*vol*(maturity**0.5))
    return result
    
def Dcalc(phi,eta,spot,strike,barrier,rate,div,maturity,vol):
    mu = mucalc(rate,vol,div)
    y2 = y2calc(spot,barrier,mu,vol,maturity,div,rate)
    result = phi*spot*exp((rate-div-rate)*maturity)*((barrier/spot)**(2*(mu+1)))*normcdf(eta*y2)-phi*strike*exp(-rate*maturity)*((barrier/spot)**(2*mu))*normcdf(eta*y2-eta*vol*(maturity**0.5))
    return result

def Ecalc(spot,strike,barrier,eta,vol,rate,maturity,div):
    mu = mucalc(rate,vol,div)
    result = 0*exp(-rate*maturity)*(normcdf(eta*x2-eta*vol*(maturity**0.5))-((barrier/spot)**(2*mu))*normcdf(eta*y2-eta*vol*(maturity**0.5)))
    return result

def Fcalc(spot,strike,barrier,eta,vol,rate,maturity,div):
    mu = mucalc(rate,vol,div)
    lambda1 = lambdacalc(mu,rate,vol)
    z = zcalc(spot,barrier,lambda1,vol,maturity)
    result = 0*(((barrier/spot)**(mu+lambda1))*normcdf(eta*z)+((barrier/spot)**(mu-lambda1))*normcdf(eta*z-2*eta*lambda1*vol*(maturity**0.5)))
    return result

def upandoutcall(spot,strike,rate,div,barrier,maturity,vol):
    eta = -1
    phi = 1
    F = Fcalc(spot,strike,barrier,eta,vol,rate,maturity,div)
    A = Acalc(phi,spot,strike,barrier,rate,div,maturity,vol)
    B = Bcalc(phi,spot,strike,barrier,rate,div,maturity,vol)
    C = Ccalc(phi,eta,spot,strike,barrier,rate,div,maturity,vol)
    D = Dcalc(phi,eta,spot,strike,barrier,rate,div,maturity,vol)
    mu = mucalc(rate,vol,div)
    lambda1 = lambdacalc(mu,rate,vol)
    z = zcalc(spot,barrier,lambda1,vol,maturity)
    
    if (strike>barrier):
        return F
    return (A-B+C-D+F)
    
def downandoutcall(spot,strike,rate,div,barrier,maturity,vol):
    eta = 1
    phi = 1
    F = Fcalc(spot,strike,barrier,eta,vol,rate,maturity,div)
    A = Acalc(phi,spot,strike,barrier,rate,div,maturity,vol)
    B = Bcalc(phi,spot,strike,barrier,rate,div,maturity,vol)
    C = Ccalc(phi,eta,spot,strike,barrier,rate,div,maturity,vol)
    D = Dcalc(phi,eta,spot,strike,barrier,rate,div,maturity,vol)
    mu = mucalc(rate,vol,div)
    lambda1 = lambdacalc(mu,rate,vol)
    z = zcalc(spot,barrier,lambda1,vol,maturity)

    if(strike>barrier):
        return (A-C+F)
    return (B-D+F)
    
def downandoutput(spot,strike,rate,div,barrier,maturity,vol):
    eta = 1
    phi = -1
    F = Fcalc(spot,strike,barrier,eta,vol,rate,maturity,div)
    A = Acalc(phi,spot,strike,barrier,rate,div,maturity,vol)
    B = Bcalc(phi,spot,strike,barrier,rate,div,maturity,vol)
    C = Ccalc(phi,eta,spot,strike,barrier,rate,div,maturity,vol)
    D = Dcalc(phi,eta,spot,strike,barrier,rate,div,maturity,vol)
    mu = mucalc(rate,vol,div)
    lambda1 = lambdacalc(mu,rate,vol)
    z = zcalc(spot,barrier,lambda1,vol,maturity)

    if(strike>barrier):
        return (A-B+C-D+F)
    return (F)


def upandoutput(spot,strike,rate,div,barrier,maturity,vol):
    eta = -1
    phi = -1
    F = Fcalc(spot,strike,barrier,eta,vol,rate,maturity,div)
    A = Acalc(phi,spot,strike,barrier,rate,div,maturity,vol)
    B = Bcalc(phi,spot,strike,barrier,rate,div,maturity,vol)
    C = Ccalc(phi,eta,spot,strike,barrier,rate,div,maturity,vol)
    D = Dcalc(phi,eta,spot,strike,barrier,rate,div,maturity,vol)
    mu = mucalc(rate,vol,div)
    lambda1 = lambdacalc(mu,rate,vol)
    z = zcalc(spot,barrier,lambda1,vol,maturity)
    
    if (strike>barrier):
        return (B-D+F)
    return (A-C+F)
    

class CommandLine(webapp2.RequestHandler):

    def get(self):
        price = 0;
        spot = float(cgi.escape(self.request.get('spot')))
        strike = float(cgi.escape(self.request.get('strike')))
        type = (cgi.escape(self.request.get('type')))
        vol = float(cgi.escape(self.request.get('vol')))
        rate =float(cgi.escape(self.request.get('rate'))) 
        div = float(cgi.escape(self.request.get('div'))) 
        maturity = float(cgi.escape(self.request.get('maturity')))
        pricertemplate = cgi.escape(self.request.get('pricer'))
        barrier = 0.0
        if(pricertemplate=="barriers"):
            barrier = float(cgi.escape(self.request.get('barrier')))
        
        d1 = (log(spot/strike) + (rate + vol*vol/2)*maturity)/(vol*(maturity**0.5))
        d2 = (log(spot/strike)+(rate-vol*vol/2)*maturity)/(vol*(maturity**0.5))
        nd1 = normcdf(d1)
        nd2 = normcdf(d2)
        pricecall = nd1*spot-nd2*strike*exp(-rate*maturity)
        cmd = cgi.escape(self.request.get('cmd'))
        delta = 0.0
        gamma = 0.0
        vega = 0.0
        theta = 0.0
        rho = 0.0
        gamma = (1.0/(2*3.1416))*exp(-d1*d1*0.5)*exp((div-rate)*maturity)/(spot*vol*(maturity**0.5))
        vega = (1.0/(2*3.1416))*exp(-d1*d1*0.5)*exp((div-rate)*maturity)*spot*(maturity**0.5)/100
        if(type=="upandoutcall"):
            price = upandoutcall(spot,strike,rate,div,barrier,maturity,vol)
            
        if(type=="downandoutcall"):
            price = downandoutcall(spot,strike,rate,div,barrier,maturity,vol)
        
        if(type=="downandoutput"):
            price = downandoutput(spot,strike,rate,div,barrier,maturity,vol)

        if(type=="upandoutput"):
            price = upandoutput(spot,strike,rate,div,barrier,maturity,vol)
        
        if(type=="call"):
            price = pricecall
            delta = nd1
            rho = strike*maturity*exp(-rate*maturity)*nd2/100
            
        nd1 = normcdf(-d1)
        nd2 = normcdf(-d2)
        priceput = nd2*strike*exp(-rate*maturity)-nd1*spot
            
        if(type=="put"):
            price = priceput;
            delta = -nd1
            rho = -strike*maturity*exp(-rate*maturity)*nd2/100
        
        if(cmd=="compute_delta"):
            self.response.out.write("Delta:"+str(delta)+"\n")
        if(cmd=="compute_vega"):
            self.response.out.write("Vega:"+str(vega)+"\n")
        if(cmd=="compute_gamma"):
            self.response.out.write("Gamma:"+str(gamma)+"\n")    
        if(cmd=="compute_rho"):
            self.response.out.write("Rho:"+str(rho)+"\n")
        if(cmd=="compute" and (type=="call" or type=="put")):    
            self.response.out.write("Price:"+str(price)+"\n")
            self.response.out.write("Delta:"+str(delta)+"\n")
            self.response.out.write("Rho:"+str(rho)+"\n")
            self.response.out.write("Gamma:"+str(gamma)+"\n")
            self.response.out.write("Vega:"+str(vega)+"\n")
            
        if((type=="upandoutcall") or (type=="downandoutcall") or (type=="downandoutput")or (type=="upandoutput")):
            self.response.out.write("Price:"+str(price)+"\n")



class MainPage(webapp2.RequestHandler):
    def get(self):
        template_values = {  }
        path = os.path.join(os.path.dirname(__file__), "index.html")
        self.response.out.write(template.render(path,template_values))



class autocallgraph(webapp2.RequestHandler):
        def post(self):
                stockPrice = cgi.escape(self.request.get('stockPrice'))
                intrate = float(cgi.escape(self.request.get('intRate')))
                divrate = float(cgi.escape(self.request.get('divRate')))
                ds = 1
                couponcount = 0
                volsarray = cgi.escape(self.request.get('volminmax'))
                volmin = float(cgi.escape(volsarray.split(",")[0]))
                volmax = float(cgi.escape(volsarray.split(",")[1]))
                couponarray = (cgi.escape(self.request.get('coupon1'))).split(',')
                coupontimesarray =  (cgi.escape(self.request.get('c1time'))).split(',')
                mat = float(cgi.escape(self.request.get('mat')))
                kbar = float(cgi.escape(self.request.get('kbar')))
                graphsetting = cgi.escape(self.request.get('graphsetting'))
                dt = 0.005
                NTS = int(mat / dt)
                NAS = 200
                volatility = volmin
                volatility2 = volmax
                Au = [None]*NAS
                Bu = [None]*NAS
                Du = [None]*NAS
                Eu = [None]*NAS
                Fu = [None]*NAS
                Auvega = [None]*NAS
                Buvega = [None]*NAS
                Duvega = [None]*NAS
                Euvega = [None]*NAS
                Fuvega = [None]*NAS

                
                prices = zeros((NAS,NTS))
                pricesnew = zeros((NAS,NTS))
                greekstore = zeros((NAS,NTS))
                stockP = int(stockPrice)
                ff=0
                for j in range(0,NTS):
                        for i in range(0,NAS):
                            Au[i] = 1 - (intrate - divrate)*(i*ds)*dt/ds+0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                            Bu[i] = 0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                            Eu[i] = -(intrate-divrate)*i*ds*dt/ds
                            Fu[i] = 0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                            Du[i] = 1 - intrate*dt
                            
                            Auvega[i] = 1 - (intrate - divrate)*(i*ds)*dt/ds+0.5*volatility2*volatility2*i*ds*i*ds*dt/(ds*ds)
                            Buvega[i] = 0.5*volatility2*volatility2*i*ds*i*ds*dt/(ds*ds)
                            Euvega[i] = -(intrate-divrate)*i*ds*dt/ds
                            Fuvega[i] = 0.5*volatility2*volatility2*i*ds*i*ds*dt/(ds*ds)
                            Duvega[i] = 1 - intrate*dt

                            
                            
                            if i!=0 and i!=(NAS-1) and j>0:
                                prices[i][j] = (Bu[i]*prices[i-1][j]+prices[i][j-1]*Du[i]+prices[i-1][j-1]*Eu[i]+(prices[i+1][j-1]-prices[i][j-1])*Fu[i])/Au[i]
                                pricesnew[i][j] = (Buvega[i]*pricesnew[i-1][j]+pricesnew[i][j-1]*Duvega[i]+pricesnew[i-1][j-1]*Euvega[i]+(pricesnew[i+1][j-1]-pricesnew[i][j-1])*Fuvega[i])/Auvega[i]
             
                            if i==0 and j>0:    
                                prices[i][j]=prices[i][j-1]*(1-intrate*dt)
                                pricesnew[i][j]=pricesnew[i][j-1]*(1-intrate*dt)
             
                            if i==(NAS-1):
                                prices[i][j]=2*prices[i-1][j] - prices[i-2][j]
                                pricesnew[i][j]=2*pricesnew[i-1][j] - pricesnew[i-2][j]
                                
                                          
                        if couponcount < size(coupontimesarray) and j==(NTS-int(float(coupontimesarray[couponcount])/dt)):
                            for l in range(int(kbar/ds),NAS):
                                prices[l][j] = couponarray[couponcount]
                                pricesnew[l][j] = couponarray[couponcount]
                            couponcount = couponcount + 1
                                 
                self.response.headers['Content-Type']='application/json'
                self.response.out.write("stock1:[")
                
                delta = 0
                gamma = 0
                vega = 0
                theta = 0
                for i in range(1,NAS):
                       pval = i*ds
                       finalprice = round(prices[i][NTS-2],3)
                       if i>1 and i<NAS-1:
                           delta = (prices[i+1][NTS-2] - prices[i-1][NTS-2])/2
                           gamma = (prices[i+1][NTS-2] + prices[i-1][NTS-2]-2*prices[i][NTS-2])/(ds*ds)
                           theta = (prices[i][NTS-2] - prices[i-1][NTS-2])/dt
                           vega = (prices[i][NTS-2] - pricesnew[i-1][NTS-2])/(volmax-volmin)
                           
                           
                       if graphsetting == "Price":     
                           self.response.out.write(""+ str(finalprice) +",")
                           
                       if graphsetting == "DeltaWStock":      
                           self.response.out.write(""+ str(delta) +",")
                           
                       if graphsetting == "GammaWStock":      
                           self.response.out.write(""+ str(gamma) +",")    
                        
                       if graphsetting == "ThetaWStock":      
                           self.response.out.write(""+ str(theta) +",")    
                           
                       if graphsetting == "VegaWStock":      
                           self.response.out.write(""+ str(vega) +",")    
    
                        
                        
                
                for i in range(1,NTS-1):
                    deltatt = (prices[stockP+1][i-2] - prices[stockP-1][i-2])/2
                    gammatt = (prices[stockP+1][i-2] + prices[stockP-1][i-2]-2*prices[stockP][i-2])/(ds*ds)
                    thetatt = (prices[stockP][i-2] - prices[stockP-1][i-2])/dt
                    vegatt = (prices[stockP][i-2] - pricesnew[stockP-1][i-2])/(volmax-volmin)

                    
                    if graphsetting == "Theta":      
                           self.response.out.write(""+ str(thetatt) +",")    
                    if graphsetting == "Delta":      
                           self.response.out.write(""+ str(deltatt) +",")       
                    if graphsetting == "Gamma":      
                           self.response.out.write(""+ str(gammatt) +",")       
                    if graphsetting == "Vega":      
                           self.response.out.write(""+ str(vegatt) +",")       

                           
                self.response.out.write("0]")



class rangeaccrualgraph(webapp2.RequestHandler):
        def post(self):
            stockPrice = cgi.escape(self.request.get('stockPrice'))
            intrate = float(cgi.escape(self.request.get('intRate')))
            divrate = 0
            ds = 1
            
            volsarray = cgi.escape(self.request.get('volminmax'))
            volmin = float(cgi.escape(volsarray.split(",")[0]))
            volmax = float(cgi.escape(volsarray.split(",")[1]))
            minstock = float(cgi.escape(self.request.get('minstock')))
            maxstock = float(cgi.escape(self.request.get('maxstock')))
            coupon = float(cgi.escape(self.request.get('coupon1')))
            mat = float(cgi.escape(self.request.get('mat')))
            graphsetting = cgi.escape(self.request.get('graphsetting'))
            stockP = int(stockPrice)
            dt = 0.00055
            NTS = int(mat / dt)
            NAS = 200
            volatility = volmin
            Au = [None]*NAS
            Bu = [None]*NAS
            Du = [None]*NAS
            Eu = [None]*NAS
            Fu = [None]*NAS
            prices = zeros((NAS,NTS))
            ff=0
            for j in range(0,NTS):
                    for i in range(0,NAS):
                        Au[i] = 1 - (intrate - divrate)*(i*ds)*dt/ds+0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                        Bu[i] = 0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                        Eu[i] = -(intrate-divrate)*i*ds*dt/ds
                        Fu[i] = 0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                        Du[i] = 1 - intrate*dt
                        if i!=0 and i!=(NAS-1) and j>0:
                            prices[i][j] = (Bu[i]*prices[i-1][j]+prices[i][j-1]*Du[i]+prices[i-1][j-1]*Eu[i]+(prices[i+1][j-1]-prices[i][j-1])*Fu[i])/Au[i]
                
                        if i==0 and j>0:    
                            prices[i][j]=prices[i][j-1]*(1-intrate*dt)
                
                        if i==(NAS-1):
                            prices[i][j]=2*prices[i-1][j] - prices[i-2][j]
                                            
                        if((i*ds) > minstock and (i*ds) < maxstock):
                            prices[i][j] = prices[i][j] + coupon*exp(-intrate*j*dt)*dt
                                    
            self.response.headers['Content-Type']='application/json'
            self.response.out.write("[")
                    
            delta = 0
            gamma = 0
            vega = 0
            for i in range(0,NAS):
                    pval = i*ds
                    finalprice = prices[i][NTS-2]
                    if i>1 and i<NAS-1:
                        delta = (prices[i+1][NTS-2] - prices[i-1][NTS-2])/2
                        gamma = (prices[i+1][NTS-2] + prices[i-1][NTS-2]-2*prices[i][NTS-2])/(ds*ds)
                        
                    if graphsetting == "Price":     
                        self.response.out.write(""+ str(finalprice) +",")
                           
                    if graphsetting == "DeltaWStock":      
                        self.response.out.write(""+ str(delta) +",")
                        
                    if graphsetting == "GammaWStock":      
                        self.response.out.write(""+ str(gamma) +",")    
                        
                    if graphsetting == "ThetaWStock":      
                        self.response.out.write(""+ str(theta) +",")    
              
            for i in range(1,NTS-1):
                    deltatt = (prices[stockP+1][i-2] - prices[stockP-1][i-2])/2
                    gammatt = (prices[stockP+1][i-2] + prices[stockP-1][i-2]-2*prices[stockP][i-2])/(ds*ds)
                    thetatt = (prices[stockP][i-2] - prices[stockP-1][i-2])/dt
                    
                    if graphsetting == "Theta":      
                           self.response.out.write(""+ str(thetatt) +",")    
                    if graphsetting == "Delta":      
                           self.response.out.write(""+ str(deltatt) +",")       
                    if graphsetting == "Gamma":      
                           self.response.out.write(""+ str(gammatt) +",")       
                           
            self.response.out.write("0]")      
    
        
            

class rangeaccrual(webapp2.RequestHandler):
        def post(self):
            stockPrice = cgi.escape(self.request.get('stockPrice'))
            intrate = float(cgi.escape(self.request.get('intRate')))
            divrate = 0
            ds = 1
            
            volsarray = cgi.escape(self.request.get('volminmax'))
            volmin = float(cgi.escape(volsarray.split(",")[0]))
            volmax = float(cgi.escape(volsarray.split(",")[1]))
            minstock = int(cgi.escape(self.request.get('minstock')))
            maxstock = int(cgi.escape(self.request.get('maxstock')))
            coupon = float(cgi.escape(self.request.get('coupon1')))
            mat = float(cgi.escape(self.request.get('mat')))
            
            dt = 0.00055
            NTS = int(mat / dt)
            NAS = 200
            volatility = volmin
            Au = [None]*NAS
            Bu = [None]*NAS
            Du = [None]*NAS
            Eu = [None]*NAS
            Fu = [None]*NAS
            prices = zeros((NAS,NTS))
            ff=0
            for j in range(1,NTS-1):
                    for i in range(0,NAS):
                        Au[i] = 1 - (intrate - divrate)*(i*ds)*dt/ds+0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                        Bu[i] = 0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                        Eu[i] = -(intrate-divrate)*i*ds*dt/ds
                        Fu[i] = 0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                        Du[i] = 1 - intrate*dt
                        if i!=0 and i!=(NAS-1) and j>0:
                            prices[i][j] = (Bu[i]*prices[i-1][j]+prices[i][j-1]*Du[i]+prices[i-1][j-1]*Eu[i]+(prices[i+1][j-1]-prices[i][j-1])*Fu[i])/Au[i]
                
                        if i==0 and j>0:    
                            prices[i][j]=prices[i][j-1]*(1-intrate*dt)
                
                        if i==(NAS-1):
                            prices[i][j]=2*prices[i-1][j] - prices[i-2][j]
                        
                        cstock = int(i*ds)                    
                        if cstock > 90 and cstock < 105:
                            prices[i][j] = prices[i][j] + coupon*exp(-intrate*j*dt)*dt
                                    
            self.response.headers['Content-Type']='application/json'
            self.response.out.write("[")
                    
            delta = 0
            gamma = 0
            vega = 0
            for i in range(0,NAS):
                    pval = i*ds
                    finalprice = prices[i][NTS-2]
                    if i>1 and i<NAS-1:
                        delta = (prices[i+1][NTS-2] - prices[i-1][NTS-2])/2
                        gamma = (prices[i+1][NTS-2] + prices[i-1][NTS-2]-2*prices[i][NTS-2])/(ds*ds)
                    self.response.out.write("{Stock: '"+str(pval)+"',OP: '"+str(finalprice)+"',BestCase: '"+str(delta)+"',WorstCase: '"+str(gamma)+"'},")
                        
            self.response.out.write("{Stock:'X',OP: 'X',BestPrice: 'X',WorstPrice: 'X'}]")


class quiz(webapp2.RequestHandler):
    def post(self):
        self.response.headers['Content-Type']='application/text'
        self.response.out.write("Q1)The seller of an atm call option on the worst performing of 5 stocks is:|");	
        self.response.out.write("[{value:'1',label:'Long volatility and short correlation'},{value:'2',label:'Short volatility and long correlation'},{value:'3',label:'Long volatility and Long correlation'},{value:'4',label:'Short volatility and short correlation'}]#")
        self.response.out.write("Q2)The buyer of a Napoleon is necessarily:|");	
        self.response.out.write("[{value:'1',label:'Long skew'},{value:'2',label:'Short skew'},{value:'3',label:'Flat skew'},{value:'4',label:'None of the above'}]#")
        self.response.out.write("Q3)You go long an atm straddle and short the strangle on a vega neutral basis. Are you necessarily:|");	
        self.response.out.write("[{value:'1',label:'Long delta'},{value:'2',label:'Short skew'},{value:'3',label:'Short vol gamma'},{value:'4',label:'Long interest rates'}]#")
        self.response.out.write("Q4)I buy an atm worst-of call and sell an atm worst-of put. Am I:|");	
        self.response.out.write("[{value:'1',label:'Long vega'},{value:'2',label:'Flat vega'},{value:'3',label:'Short vega'},{value:'4',label:'Depends on the spot'}]#")
        self.response.out.write("Q5)I price a 3 year monthly asian himalayan option across 3 stocks. Just after I finish pricing the option, one of the 3 companies decides to increase it's dividends for the next 3 years. Does this make the himalaya worth:|");	
        self.response.out.write("[{value:'1',label:'More'},{value:'2',label:'Less'},{value:'3',label:'Same'},{value:'4',label:'Not definite either way'}]#")
        self.response.out.write("Q6)I sell a 1 year European digital that has a barrier 30% on the upside and buy a 1 year zero coupon bond with nominal equal to the maximum option payoff. Is my position?:|");	
        self.response.out.write("[{value:'1',label:'Long delta'},{value:'2',label:'Long skew'},{value:'3',label:'Long vega'},{value:'4',label:'Short vega'}]#")
        self.response.out.write("Q7)An atm call which knocks out at 130 with full rebate is necessarily:|");	
        self.response.out.write("[{value:'1',label:'Cheaper than an atm-130 call spread'},{value:'2',label:'More expensive than an atm-130 call spread'},{value:'3',label:'More expensive than an atm call which knocks out at 120 with full rebate'},{value:'4',label:'Cheaper than an atm call which knocks out at 120 with full rebate'}]#")
        self.response.out.write("Q8)I am long a very deep in the money put on a stock. Which of the following would be regarded as my biggest risk?:|");	
        self.response.out.write("[{value:'1',label:'Theta'},{value:'2',label:'Vega'},{value:'3',label:'Gamma'},{value:'4',label:'Forward'}]#")
        self.response.out.write("Q9)You are long an American rebate which pays a fixed amount if the barrier on the upside is ever triggered and spot is just below the barrier. Assuming the same level of spot, what happens to delta as the maturity decreases.:|");	
        self.response.out.write("[{value:'1',label:'Becomes very large and positive'},{value:'2',label:'Becomes very large and negative'},{value:'3',label:'Tends to zero'},{value:'4',label:'Stays constant'}]#")
        self.response.out.write("Q10)I buy a Himalaya call. Am I:|");	
        self.response.out.write("[{value:'1',label:'Long vega'},{value:'2',label:'Short vega'},{value:'3',label:'Flat vega'},{value:'4',label:'At any given moment, all of the above, depending on the level of spot'}]#")

class quizanswer(webapp2.RequestHandler):
    def post(self):
        answers = cgi.escape(self.request.get('answer'))
        self.response.headers['Content-Type']='application/text'
        allanswers = answers.split("*")
        qs = size(allanswers)
        ans = ""
        count = 0
        finalresponse = ""
        for i in range(0,10):
            ans = allanswers[i].split("|")
            if size(ans) > 0:
                if(size(ans[0].split("="))>1):
                   if(i==0 and ans[0].split("=")[1] == "Short volatility and short correlation"):
                       finalresponse = finalresponse + "Q1 Correct "
                       count = count+1
                   if(i==1 and ans[0].split("=")[1] == "None of the above"):
                       finalresponse = finalresponse + "Q2 Correct "
                       count = count+1
                   if(i==2 and ans[0].split("=")[1] == "Short vol gamma"):
                       finalresponse = finalresponse + "Q3 Correct "
                       count = count+1
                   if(i==3 and ans[0].split("=")[1] == "Short vega"):
                       finalresponse = finalresponse + "Q4 Correct "
                       count = count+1

                   if(i==4 and ans[0].split("=")[1] == "Less"):
                       finalresponse = finalresponse + "Q5 Correct "
                       count = count+1

                   if(i==5 and ans[0].split("=")[1] == "Short vega"):
                       finalresponse = finalresponse + "Q6 Correct "
                       count = count+1

                   if(i==6 and ans[0].split("=")[1] == "More expensive than an atm-130 call spread"):
                       finalresponse = finalresponse + "Q7 Correct "
                       count = count+1

                   if(i==7 and ans[0].split("=")[1] == "Forward"):
                       finalresponse = finalresponse + "Q8 Correct "
                       count = count+1

                   if(i==8 and ans[0].split("=")[1] == "Becomes very large and positive"):
                       finalresponse = finalresponse + "Q9 Correct "
                       count = count+1

                   if(i==9 and ans[0].split("=")[1] == "Long vega"):
                       finalresponse = finalresponse + "Q10 Correct "
                       count = count+1


        self.response.out.write(finalresponse+"*"+str(count))


class quiz1(webapp2.RequestHandler):
    def post(self):
        self.response.headers['Content-Type']='application/text'
        self.response.out.write("Q1)I think that volatility will increase so I buy a call option and try and remain delta neutral by buying or selling the underlying to flatten my delta at the end of each week. If I increase the frequency of my hedging to daily, which of the following is certain? (assume no slippage cost in trading the underlying):|");	
        self.response.out.write("[{value:'1',label:'My expected profit increases'},{value:'2',label:'My expected profit decreases'},{value:'3',label:'The variance of my profit increases'},{value:'4',label:'None of the above'}]#")
        self.response.out.write("Q2)My trading book says that I am earning theta. Must I be short gamma?:|")	
        self.response.out.write("[{value:'1',label:'Yes'},{value:'2',label:'No'},{value:'3',label:'-'},{value:'4',label:'-'}]#")
        self.response.out.write("Q3)The volatility input for an Asian Himalaya will be closest to that of:|")
        self.response.out.write("[{value:'1',label:'European'},{value:'2',label:'Asian with the same schedule as the Himalaya'},{value:'3',label:'A shorter dated volatility than that used for an Asian with the same schedule'},{value:'4',label:'An option with a longer dated volatilty than that of the European'}]#")
        self.response.out.write("Q4)I buy an Altiplano that pays me a coupon if none of the assets ever fall below a barrier. Am I?:|")
        self.response.out.write("[{value:'1',label:'Long vega'},{value:'2',label:'Flat vega'},{value:'3',label:'Short vega'},{value:'4',label:'All of above depending on the spot'}]#")
        self.response.out.write("Q5)I buy an Altiplano that pays me a coupon if none of the assets ever fall below a barrier. Am I?:|")	
        self.response.out.write("[{value:'1',label:'Long Correlation'},{value:'2',label:'Flat Correlation'},{value:'3',label:'Short Correlation'},{value:'4',label:'All of above depending on the spot'}]#")
        self.response.out.write("Q6)I buy a double knock-out rebate that pays 10% providing the FTSE future stays within 20% of its initial value. Am I:|")
        self.response.out.write("[{value:'1',label:'Long vega'},{value:'2',label:'Short vega'},{value:'3',label:'Long dividends'},{value:'4',label:'Short Dividends'}]#")
        self.response.out.write("Q7)I sell an atm put on the best performing of three assets. Am I:|");	
        self.response.out.write("[{value:'1',label:'Long correlation and Long Vega'},{value:'2',label:'Short correlation and Long vega'},{value:'3',label:'Long correlation and Short vega'},{value:'4',label:'Short correlation and Short vega'}]#")
        self.response.out.write("Q8)I want exposure to a basket of stocks. Which of the following is cheapest?:|");	
        self.response.out.write("[{value:'1',label:'A lookback call on the basket where the strike is lowest value over the first 10% of the maturity'},{value:'2',label:'A basket of call options'},{value:'3',label:'A call on the basket, where the stocks are individually capped at 130'},{value:'4',label:'An atm-130 call spread on the basket'}]#")
        self.response.out.write("Q9)I sell 10 covered calls by selling an atm call (delta = 50%) and buying stock. How many units of stock should I buy assuming I started with zero position?:|")	
        self.response.out.write("[{value:'1',label:'Zero'},{value:'2',label:'Five'},{value:'3',label:'Ten'},{value:'4',label:'Twenty'}]#")
        self.response.out.write("Q10)Which of the following is the odd one out?:|")	
        self.response.out.write("[{value:'1',label:'Himalaya Call'},{value:'2',label:'Worst-of Call'},{value:'3',label:'Lookback Price Call'},{value:'4',label:'Corridor'}]#")




class quizanswer1(webapp2.RequestHandler):
    def post(self):
        answers = cgi.escape(self.request.get('answer'))
        self.response.headers['Content-Type']='application/text'
        allanswers = answers.split("*")
        qs = size(allanswers)
        ans = ""
        count = 0
        finalresponse = ""
        for i in range(0,10):
            ans = allanswers[i].split("|")
            if size(ans) > 0:
                if(size(ans[0].split("="))>1):
                   if(i==0 and ans[0].split("=")[1] == "None of the above"):
                       finalresponse = finalresponse + "Q1 Correct "
                       count = count+1
                   if(i==1 and ans[0].split("=")[1] == "No"):
                       finalresponse = finalresponse + "Q2 Correct "
                       count = count+1
                   if(i==2 and ans[0].split("=")[1] == "A shorter dated volatility than that used for an Asian with the same schedule"):
                       finalresponse = finalresponse + "Q3 Correct "
                       count = count+1
                   if(i==3 and ans[0].split("=")[1] == "Short vega"):
                       finalresponse = finalresponse + "Q4 Correct "
                       count = count+1

                   if(i==4 and ans[0].split("=")[1] == "Long Correlation"):
                       finalresponse = finalresponse + "Q5 Correct "
                       count = count+1

                   if(i==5 and ans[0].split("=")[1] == "Short vega"):
                       finalresponse = finalresponse + "Q6 Correct "
                       count = count+1

                   if(i==6 and ans[0].split("=")[1] == "Short correlation and Short vega"):
                       finalresponse = finalresponse + "Q7 Correct "
                       count = count+1

                   if(i==7 and ans[0].split("=")[1] == "A call on the basket, where the stocks are individually capped at 130"):
                       finalresponse = finalresponse + "Q8 Correct "
                       count = count+1

                   if(i==8 and ans[0].split("=")[1] == "Ten"):
                       finalresponse = finalresponse + "Q9 Correct "
                       count = count+1

                   if(i==9 and ans[0].split("=")[1] == "Corridor"):
                       finalresponse = finalresponse + "Q10 Correct "
                       count = count+1


        self.response.out.write(finalresponse+"*"+str(count))


                   
        
class quiz2(webapp2.RequestHandler):
    def post(self):
        self.response.headers['Content-Type']='application/text'
        self.response.out.write("Q1)Which of these options can be valued by the regular Black-Scholes Equation for European Options (the spot is at 100, American style barrier)?:|")
        self.response.out.write("[{value:'1',label:'1yr European Call with 110 euro strike call with knock in at 130'},{value:'2',label:'1yr European Call with 90 euro strike call with knock in at 95'},{value:'3',label:'1yr European Call with 110 euro strike call with knock in at 80'},{value:'4',label:'1yr European Call with 130 euro strike call with knock in at 110'}]#")
        self.response.out.write("Q2)Which of these would you expect to be the cheapest?:|")	
        self.response.out.write("[{value:'1',label:'ATM Call '},{value:'2',label:'ATM Lookback Increasing Price Call  '},{value:'3',label:'ATM Lookback Increasing Strike Call'},{value:'4',label:'ATM Straddle'}]#")
        self.response.out.write("Q3)A two stock basket european call is a type of:|")
        self.response.out.write("[{value:'1',label:' Hybrid Option'},{value:'2',label:' Outperformance Option'},{value:'3',label:'Barrier Option'},{value:'4',label:'Chooser Option'}]#")
        self.response.out.write("Q4)When is the price of a basket of options equal to the price of an option on a basket?:|")
        self.response.out.write("[{value:'1',label:' When all correlations are the same'},{value:'2',label:' When all volatilities are the same'},{value:'3',label:' When all correlations are 100% '},{value:'4',label:' When all correlations are 0%'}]#")
        self.response.out.write("Q5)When might a forward starting vanilla option have a delta?:|")	
        self.response.out.write("[{value:'1',label:' In the presence of a flat interest rate term structure '},{value:'2',label:' In the presence of discrete dividends'},{value:'3',label:' In the presence of negative interest rates '},{value:'4',label:' None of the above '}]#")
        self.response.out.write("Q6)For which of the following types of options might Black-Scholes be most suitable?:|")
        self.response.out.write("[{value:'1',label:' Short dated options on short dated bonds '},{value:'2',label:' Short dated options on long dated bonds '},{value:'3',label:' Long dated options on short dated bonds '},{value:'4',label:' Long dated options on long dated bonds'}]#")
        self.response.out.write("Q7)For which of the following types of options might having a bucketed rho split be useful?:|");	
        self.response.out.write("[{value:'1',label:'European Option'},{value:'2',label:'Power Option'},{value:'3',label:'Asian Option'},{value:'4',label:'Digital Option'}]#")
        self.response.out.write("Q8)When might a digital option, which can pay up to $100, be worth more than $100? (Assume interest rates are zero)?:|");	
        self.response.out.write("[{value:'1',label:'High Volatility'},{value:'2',label:'Low Volatility'},{value:'3',label:'High Dividend Yield'},{value:'4',label:'None of the above'}]#")
        self.response.out.write("Q9)On any day the market can only go up in steps of 1 or down in steps of 9. Given that out of 10 steps, 9 will be up and 1 will be down. What is the price of a one day ATM digital call paying $1 if the market finishes at a higher level tomorrow than today?:|")	
        self.response.out.write("[{value:'1',label:'0'},{value:'2',label:'0.9'},{value:'3',label:'1'},{value:'4',label:'4.5'}]#")
        self.response.out.write("Q10)Assume zero growth. Which of the following would you expect to have the highest vega?:|")	
        self.response.out.write("[{value:'1',label:'1yr 90 put'},{value:'2',label:'1yr 110 call'},{value:'3',label:'5yr 90 put'},{value:'4',label:'5yr 110 call'}]#")



class quizanswer2(webapp2.RequestHandler):
    def post(self):
        answers = cgi.escape(self.request.get('answer'))
        self.response.headers['Content-Type']='application/text'
        allanswers = answers.split("*")
        qs = size(allanswers)
        ans = ""
        count = 0
        finalresponse = ""
        for i in range(0,10):
            ans = allanswers[i].split("|")
            if size(ans) > 0:
                if(size(ans[0].split("="))>1):
                   if(i==0 and ans[0].split("=")[1] == "1yr European Call with 130 euro strike call with knock in at 110"):
                       finalresponse = finalresponse + "Q1 Correct "
                       count = count+1
                   if(i==1 and ans[0].split("=")[1] == "ATM Lookback Increasing Strike Call"):
                       finalresponse = finalresponse + "Q2 Correct "
                       count = count+1
                   if(i==2 and ans[0].split("=")[1] == " Outperformance Option"):
                       finalresponse = finalresponse + "Q3 Correct "
                       count = count+1
                   if(i==3 and ans[0].split("=")[1] == " When all correlations are 100% "):
                       finalresponse = finalresponse + "Q4 Correct "
                       count = count+1

                   if(i==4 and ans[0].split("=")[1] == " In the presence of discrete dividends"):
                       finalresponse = finalresponse + "Q5 Correct "
                       count = count+1

                   if(i==5 and ans[0].split("=")[1] == " Short dated options on long dated bonds "):
                       finalresponse = finalresponse + "Q6 Correct "
                       count = count+1

                   if(i==6 and ans[0].split("=")[1] == "Asian Option"):
                       finalresponse = finalresponse + "Q7 Correct "
                       count = count+1

                   if(i==7 and ans[0].split("=")[1] == "None of the above"):
                       finalresponse = finalresponse + "Q8 Correct "
                       count = count+1

                   if(i==8 and ans[0].split("=")[1] == "0.9"):
                       finalresponse = finalresponse + "Q9 Correct "
                       count = count+1

                   if(i==9 and ans[0].split("=")[1] == "5yr 110 call"):
                       finalresponse = finalresponse + "Q10 Correct "
                       count = count+1


        self.response.out.write(finalresponse+"*"+str(count))



class quiz3(webapp2.RequestHandler):
    def post(self):
        self.response.headers['Content-Type']='application/text'
        self.response.out.write("Q1)In order to sell the skew, which of the following would be most appropriate?:|")
        self.response.out.write("[{value:'1',label:'Buy an ATM-110 call spread'},{value:'2',label:'Buy a 90-ATM call spread'},{value:'3',label:'Buy a 90-ATM put spread'},{value:'4',label:'Sell a 90-ATM put spread'}]#")
        self.response.out.write("Q2)What is the vega of an option?:|")	
        self.response.out.write("[{value:'1',label:'The difference between the integrals of the expected gamma p/l at one vol and another'},{value:'2',label:'The square root of the variance for an option'},{value:'3',label:'The volatility of an option measured at two different strikes'},{value:'4',label:'None of the above'}]#")
        self.response.out.write("Q3)Which of these would you expect to have the highest dDelta/dTime:|")
        self.response.out.write("[{value:'1',label:' 1 week ATM call'},{value:'2',label:'1 week 105 call'},{value:'3',label:'1yr ATM call'},{value:'4',label:'1yr 105 call'}]#")
        self.response.out.write("Q4)For a digital option, why isn't the delta the probability of exercise?:|")
        self.response.out.write("[{value:'1',label:'Because of the pricing of volatility skew is not defined for digital options'},{value:'2',label:'Because of the pricing of forward drift changes the expected carry pnl'},{value:'3',label:'Because the probability of exercise does not depend on the magnitude of the moves, while the hedge does.'},{value:'4',label:'None of the above'}]#")
        self.response.out.write("Q5)An option trader managing an american barrier option close to the barrier would want to give which of the following types of orders to his cash trader to help hedge the position?:|")	
        self.response.out.write("[{value:'1',label:'GTC - Good till cancelled'},{value:'2',label:'MIT - Market If Touched'},{value:'3',label:'FOK'},{value:'4',label:'AON'}]#")
        self.response.out.write("Q6)A Daily Range Accrual Option can be considered to be like what?:|")
        self.response.out.write("[{value:'1',label:'A series of European Digitals'},{value:'2',label:'A series of American Digitals'},{value:'3',label:'A series of zero strike calls'},{value:'4',label:'A series of always OTM puts'}]#")
        self.response.out.write("Q7)What is meant by the term 'cost of carry'?:|");	
        self.response.out.write("[{value:'1',label:'The cost of all aggregated losses on a trading book'},{value:'2',label:'The one-off slippage cost when initiating a hedge'},{value:'3',label:'The day-to-day costs of holding an asset against an option as a hedge'},{value:'4',label:'The cost to borrow a stock to later short it as a hedge against a long call position'}]#")
        self.response.out.write("Q8)A newspaper lists the clean price of a 2yr zero-coupon bond to be  90%, whereas it's dirty price is 95%. What does this tell you?:|");	
        self.response.out.write("[{value:'1',label:'It has an annual coupon of 2.5%'},{value:'2',label:'It has an annual coupon of 5%'},{value:'3',label:'It has an annual coupon of -2.5%'},{value:'4',label:'None of the above'}]#")
        self.response.out.write("Q9)A call option on another vanilla call option is sometimes referred to as a Cacall. What type of option is this?:|")	
        self.response.out.write("[{value:'1',label:'A call on the CAC?'},{value:'2',label:'An OTM call'},{value:'3',label:'A compound option'},{value:'4',label:'None of the above'}]#")
        self.response.out.write("Q10)Spot the odd one out:?:|")	
        self.response.out.write("[{value:'1',label:'Delta of Gamma'},{value:'2',label:'Speed'},{value:'3',label:'Kappa'},{value:'4',label:'Omega'}]#")



class quizanswer3(webapp2.RequestHandler):
    def post(self):
        answers = cgi.escape(self.request.get('answer'))
        self.response.headers['Content-Type']='application/text'
        allanswers = answers.split("*")
        qs = size(allanswers)
        ans = ""
        count = 0
        finalresponse = ""
        for i in range(0,10):
            ans = allanswers[i].split("|")
            if size(ans) > 0:
                if(size(ans[0].split("="))>1):
                   if(i==0 and ans[0].split("=")[1] == "Buy a 90-ATM put spread"):
                       finalresponse = finalresponse + "Q1 Correct "
                       count = count+1
                   if(i==1 and ans[0].split("=")[1] == "The difference between the integrals of the expected gamma p/l at one vol and another"):
                       finalresponse = finalresponse + "Q2 Correct "
                       count = count+1
                   if(i==2 and ans[0].split("=")[1] == "1 week 105 call"):
                       finalresponse = finalresponse + "Q3 Correct "
                       count = count+1
                   if(i==3 and ans[0].split("=")[1] == "Because the probability of exercise does not depend on the magnitude of the moves, while the hedge does."):
                       finalresponse = finalresponse + "Q4 Correct "
                       count = count+1

                   if(i==4 and ans[0].split("=")[1] == "MIT - Market If Touched"):
                       finalresponse = finalresponse + "Q5 Correct "
                       count = count+1

                   if(i==5 and ans[0].split("=")[1] == "A series of European Digitals"):
                       finalresponse = finalresponse + "Q6 Correct "
                       count = count+1

                   if(i==6 and ans[0].split("=")[1] == "The day-to-day costs of holding an asset against an option as a hedge"):
                       finalresponse = finalresponse + "Q7 Correct "
                       count = count+1

                   if(i==7 and ans[0].split("=")[1] == "None of the above"):
                       finalresponse = finalresponse + "Q8 Correct "
                       count = count+1

                   if(i==8 and ans[0].split("=")[1] == "A compound option"):
                       finalresponse = finalresponse + "Q9 Correct "
                       count = count+1

                   if(i==9 and ans[0].split("=")[1] == "Kappa"):
                       finalresponse = finalresponse + "Q10 Correct "
                       count = count+1


        self.response.out.write(finalresponse+"*"+str(count))




class quiz4(webapp2.RequestHandler):
    def post(self):
        self.response.headers['Content-Type']='application/text'
        self.response.out.write("Q1)Options on which underlying usually show a symmetrical implied volatility smile?:|")
        self.response.out.write("[{value:'1',label:'Currencies'},{value:'2',label:'Bonds'},{value:'3',label:'Equities'},{value:'4',label:'None of the above'}]#")
        self.response.out.write("Q2)If x follows a geometric Brownian motion process, will the variable x-squared also follow this type of process?:|")	
        self.response.out.write("[{value:'1',label:'Yes'},{value:'2',label:'No'},{value:'3',label:'-'},{value:'4',label:'-'}]#")
        self.response.out.write("Q3)Which method is most accurate for vanilla calls on non dividend paying stock?:|")
        self.response.out.write("[{value:'1',label:'Binomial Tree'},{value:'2',label:'Black Scholes'},{value:'3',label:'Monte Carlo'},{value:'4',label:'None of these'}]#")
        self.response.out.write("Q4)A volatility capped option is an option where the underlying is deleveraged (sold) into cash if the volatility goes above a certain level, to artificially reduce the vol, and releveraged when the vol decreases. Given your knowledge of skew, does this rebalancing effectively replicate a long or short gamma position?:|")
        self.response.out.write("[{value:'1',label:'Long'},{value:'2',label:'Short'},{value:'3',label:'Cant say'},{value:'4',label:'-'}]#")
        self.response.out.write("Q5)By the Central Limit Theorem, a sequence of independent and identically distributed random variables, with finite mean and non-zero variance, tends to which distribution?:|")
        self.response.out.write("[{value:'1',label:'Binomial'},{value:'2',label:'Log Normal'},{value:'3',label:'Poisson'},{value:'4',label:'Normal'}]#")
        self.response.out.write("Q6)You hold a Chicago Nikkei futures contract, which you bought for dollars, whose value is the value of the Nikkei but quoted in dollars. What is your return if the Nikkei remains at the same level, but the JPY per USD increases?:|")
        self.response.out.write("[{value:'1',label:'Negative'},{value:'2',label:'Zero'},{value:'3',label:'Positive'},{value:'4',label:'-'}]#")

        self.response.out.write("Q7)Does a hedged investor who is short futures, long non dividend paying stock lose or make money if the basis strengthens?:|")
        self.response.out.write("[{value:'1',label:'Lose'},{value:'2',label:'Gains'},{value:'3',label:'Neutral, because the stock doesnt pay any dividend'},{value:'4',label:'-'}]#")
        self.response.out.write("Q8)Combining an ATM bear put spread and an ATM bull call spread creates a similar position to a?:|");	
        self.response.out.write("[{value:'1',label:'Short Strangle'},{value:'2',label:'Inverse Risk Reversal'},{value:'3',label:'Long Condor'},{value:'4',label:'Short Butterly'}]#")
        self.response.out.write("Q9)You are long a double barrier rebate option, where you receive 1USD when the stock price of the underlying is within the range 90%-110%. What is your exposure to volatility and the forward of the stock if the underlying is at 105%, assuming the forward is at 100%?:|")	
        self.response.out.write("[{value:'1',label:'Long vol short the forward'},{value:'2',label:'Short vol long the forward'},{value:'3',label:'Long vol long the forward'},{value:'4',label:'Short vol short the forward'}]#")
        self.response.out.write("Q10)As the time to maturity of an up and in call decreases, does the gap risk increase or decrease?:|")	
        self.response.out.write("[{value:'1',label:'Increase'},{value:'2',label:'Decrease'},{value:'3',label:'Remains the same as the jump in intrinsic value stays constant'},{value:'4',label:'-'}]#")



class quizanswer4(webapp2.RequestHandler):
    def post(self):
        answers = cgi.escape(self.request.get('answer'))
        self.response.headers['Content-Type']='application/text'
        allanswers = answers.split("*")
        qs = size(allanswers)
        ans = ""
        count = 0
        finalresponse = ""
        for i in range(0,10):
            ans = allanswers[i].split("|")
            if size(ans) > 0:
                if(size(ans[0].split("="))>1):
                   if(i==0 and ans[0].split("=")[1] == "Currencies"):
                       finalresponse = finalresponse + "Q1 Correct "
                       count = count+1
                   if(i==1 and ans[0].split("=")[1] == "Yes"):
                       finalresponse = finalresponse + "Q2 Correct "
                       count = count+1
                   if(i==2 and ans[0].split("=")[1] == "Black Scholes"):
                       finalresponse = finalresponse + "Q3 Correct "
                       count = count+1
                   if(i==3 and ans[0].split("=")[1] == "Short"):
                       finalresponse = finalresponse + "Q4 Correct "
                       count = count+1

                   if(i==4 and ans[0].split("=")[1] == "Normal"):
                       finalresponse = finalresponse + "Q5 Correct "
                       count = count+1

                   if(i==5 and ans[0].split("=")[1] == "Zero"):
                       finalresponse = finalresponse + "Q6 Correct "
                       count = count+1

                   if(i==6 and ans[0].split("=")[1] == "Lose"):
                       finalresponse = finalresponse + "Q7 Correct "
                       count = count+1

                   if(i==7 and ans[0].split("=")[1] == "Short Butterly"):
                       finalresponse = finalresponse + "Q8 Correct "
                       count = count+1

                   if(i==8 and ans[0].split("=")[1] == "Short vol short the forward"):
                       finalresponse = finalresponse + "Q9 Correct "
                       count = count+1

                   if(i==9 and ans[0].split("=")[1] == "Increase"):
                       finalresponse = finalresponse + "Q10 Correct "
                       count = count+1


        self.response.out.write(finalresponse+"*"+str(count))




class quiz5(webapp2.RequestHandler):
    def post(self):
        self.response.headers['Content-Type']='application/text'
        self.response.out.write("Q1)A 3y monthly asian call can be decomposed into 36 european calls (a 1 month plus a 2 month plus 36 month) by taking their average value:|")
        self.response.out.write("[{value:'1',label:'TRUE'},{value:'2',label:'FALSE'}]#")
        self.response.out.write("Q2)Since it is more expensive, the effective correlation exposure on a basket of calls on 5 stocks is greater than for a call on a basket on the same 5 stocks.:|")	
        self.response.out.write("[{value:'1',label:'TRUE'},{value:'2',label:'FALSE'}]#")
        self.response.out.write("Q3)Buying an atm call and selling an atm put is economically equivalent to buying the stock?:|")
        self.response.out.write("[{value:'1',label:'TRUE'},{value:'2',label:'FALSE'}]#")
        self.response.out.write("Q4)A Markov process can model an inefficent market where predictions can be made about future stock prices, true or false?:|")
        self.response.out.write("[{value:'1',label:'TRUE'},{value:'2',label:'FALSE'}]#")
        self.response.out.write("Q5)Time value of an American Call option will increase as the time to maturity increases?:|")
        self.response.out.write("[{value:'1',label:'TRUE'},{value:'2',label:'FALSE'}]#")
        self.response.out.write("Q6)A Markov process assumes that a future price distribution can be formed from historic prices. True of False?:|")
        self.response.out.write("[{value:'1',label:'TRUE'},{value:'2',label:'FALSE'}]#")

        self.response.out.write("Q7)It is never optimal to early exercise an American Put on a non dividend paying stock, true or false?:|")
        self.response.out.write("[{value:'1',label:'TRUE'},{value:'2',label:'FALSE'}]#")
        self.response.out.write("Q8)You buy 300 ATM Puts on a company. The next day, the company cuts its forecast dividends by 10%. All else remaining the same, you will make money from your puts?:|");	
        self.response.out.write("[{value:'1',label:'TRUE'},{value:'2',label:'FALSE'}]#")
        self.response.out.write("Q9)A seller of an ATM Worst-of European Call is selling correlation?:|")	
        self.response.out.write("[{value:'1',label:'TRUE'},{value:'2',label:'FALSE'}]#")
        self.response.out.write("Q10)A trader agrees to pay a fixed rate of 2% today versus receiving LIBOR 0.25 percent in three months. This is an example of a swaption?:|")	
        self.response.out.write("[{value:'1',label:'TRUE'},{value:'2',label:'FALSE'}]#")



class quizanswer5(webapp2.RequestHandler):
    def post(self):
        answers = cgi.escape(self.request.get('answer'))
        self.response.headers['Content-Type']='application/text'
        allanswers = answers.split("*")
        qs = size(allanswers)
        ans = ""
        count = 0
        finalresponse = ""
        for i in range(0,10):
            ans = allanswers[i].split("|")
            if size(ans) > 0:
                if(size(ans[0].split("="))>1):
                   if(i==0 and ans[0].split("=")[1] == "FALSE"):
                       finalresponse = finalresponse + "Q1 Correct "
                       count = count+1
                   if(i==1 and ans[0].split("=")[1] == "FALSE"):
                       finalresponse = finalresponse + "Q2 Correct "
                       count = count+1
                   if(i==2 and ans[0].split("=")[1] == "FALSE"):
                       finalresponse = finalresponse + "Q3 Correct "
                       count = count+1
                   if(i==3 and ans[0].split("=")[1] == "FALSE"):
                       finalresponse = finalresponse + "Q4 Correct "
                       count = count+1

                   if(i==4 and ans[0].split("=")[1] == "TRUE"):
                       finalresponse = finalresponse + "Q5 Correct "
                       count = count+1

                   if(i==5 and ans[0].split("=")[1] == "FALSE"):
                       finalresponse = finalresponse + "Q6 Correct "
                       count = count+1

                   if(i==6 and ans[0].split("=")[1] == "TRUE"):
                       finalresponse = finalresponse + "Q7 Correct "
                       count = count+1

                   if(i==7 and ans[0].split("=")[1] == "FALSE"):
                       finalresponse = finalresponse + "Q8 Correct "
                       count = count+1

                   if(i==8 and ans[0].split("=")[1] == "TRUE"):
                       finalresponse = finalresponse + "Q9 Correct "
                       count = count+1

                   if(i==9 and ans[0].split("=")[1] == "FALSE"):
                       finalresponse = finalresponse + "Q10 Correct "
                       count = count+1

        self.response.out.write(finalresponse+"*"+str(count))






            
class autocallpricing(webapp2.RequestHandler):
        def post(self):
                stockPrice = cgi.escape(self.request.get('stockPrice'))
                intrate = float(cgi.escape(self.request.get('intRate')))
                divrate = float(cgi.escape(self.request.get('divRate')))
                ds = 1
                couponcount = 0
                volsarray = cgi.escape(self.request.get('volminmax'))
                volmin = float(cgi.escape(volsarray.split(",")[0]))
                volmax = float(cgi.escape(volsarray.split(",")[1]))
                couponarray = (cgi.escape(self.request.get('coupon1'))).split(',')
                coupontimesarray =  (cgi.escape(self.request.get('c1time'))).split(',')
                mat = float(cgi.escape(self.request.get('mat')))
                kbar = float(cgi.escape(self.request.get('kbar')))
                dt = 0.005
                NTS = int(mat / dt)
                NAS = 200
                volatility = volmin
                Au = [None]*NAS
                Bu = [None]*NAS
                Du = [None]*NAS
                Eu = [None]*NAS
                Fu = [None]*NAS
                prices = zeros((NAS,NTS))
                ff=0
                for j in range(0,NTS-1):
                        for i in range(0,NAS):
                            Au[i] = 1 - (intrate - divrate)*(i*ds)*dt/ds+0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                            Bu[i] = 0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                            Eu[i] = -(intrate-divrate)*i*ds*dt/ds
                            Fu[i] = 0.5*volatility*volatility*i*ds*i*ds*dt/(ds*ds)
                            Du[i] = 1 - intrate*dt
                            if i!=0 and i!=(NAS-1) and j>0:
                                prices[i][j] = (Bu[i]*prices[i-1][j]+prices[i][j-1]*Du[i]+prices[i-1][j-1]*Eu[i]+(prices[i+1][j-1]-prices[i][j-1])*Fu[i])/Au[i]
             
                            if i==0 and j>0:    
                                prices[i][j]=prices[i][j-1]*(1-intrate*dt)
             
                            if i==(NAS-1):
                                prices[i][j]=2*prices[i-1][j] - prices[i-2][j]
                                          
                        if couponcount < size(coupontimesarray) and j==(NTS-int(float(coupontimesarray[couponcount])/dt)):
                            for l in range(int(kbar/ds),NAS):
                                prices[l][j] = couponarray[couponcount]
                            couponcount = couponcount + 1
                                 
                self.response.headers['Content-Type']='application/json'
                self.response.out.write("[")
                
                delta = 0
                gamma = 0
                vega = 0
                for i in range(0,NAS):
                       pval = i*ds
                       finalprice = prices[i][NTS-2]
                       if i>1 and i<NAS-1:
                           delta = (prices[i+1][NTS-2] - prices[i-1][NTS-2])/2
                           gamma = (prices[i+1][NTS-2] + prices[i-1][NTS-2]-2*prices[i][NTS-2])/(ds*ds)
                       self.response.out.write("{Stock: '"+str(pval)+"',OP: '"+str(finalprice)+"',BestCase: '"+str(delta)+"',WorstCase: '"+str(gamma)+"'},")
                       
                self.response.out.write("{Stock:'X',OP: 'X',BestPrice: 'X',WorstPrice: 'X'}]")
                       


                       
app = webapp2.WSGIApplication([('/', MainPage),('/autocall',autocallpricing),('/autocallgraph',autocallgraph),('/rangeaccuralgraph',rangeaccrualgraph),('/rangeaccural',rangeaccrual),('/quiz',quiz),('/quizanswer',quizanswer),('/quiz1',quiz1),('/quizanswer1',quizanswer1),('/quizanswer2',quizanswer2),('/quiz2',quiz2),('/quizanswer3',quizanswer3),('/quiz3',quiz3),('/quizanswer4',quizanswer4),('/quiz4',quiz4),('/quizanswer5',quizanswer5),('/quiz5',quiz5),('/commandline',CommandLine)],debug=True)




