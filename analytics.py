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


def erfcc(x):
    z = abs(x)
    t = 1. / (1. + 0.5*z)
    r = t * exp(-z*z-1.26551223+t*(1.00002368+t*(.37409196+t*(.09678418+t*(-.18628806+t*(.27886807+t*(-1.13520398+t*(1.48851587+t*(-.82215223+t*.17087277)))))))))
    if (x >= 0):
        return r
    else:
        return 2. - r

def ncdf(x):
    return 1. - 0.5*erfcc(x/(2**0.5))


class basicpricer(webapp2.RequestHandler):
    def post(self):
        stockPrice = (cgi.escape(self.request.get('stockPrice'))).split(',')
        intRate = (cgi.escape(self.request.get('intRate'))).split(',')
        strike = (cgi.escape(self.request.get('strike'))).split(',')
        vol = (cgi.escape(self.request.get('vol'))).split(',')
        mat = (cgi.escape(self.request.get('mat'))).split(',')
        barrier = (cgi.escape(self.request.get('barrier'))).split(',')
        divs = (cgi.escape(self.request.get('divs'))).split(',')
        
        mmin = (cgi.escape(self.request.get('mmin'))).split(',')
        mmax = (cgi.escape(self.request.get('mmax'))).split(',')
        
        stockPrice = map(float,stockPrice)
        intRate = map(float,intRate)
        vol = map(float,vol)
        strike = map(int,strike)
        mat = map(float,mat)
        barrier = map(float,barrier)
        divs = map(float,divs)
        mmin = map(float,mmin)
        mmax = map(float,mmax)
        
        count = len(stockPrice)
        a=zeros((count))
        b=zeros((count))
        d1=zeros((count))
        d2=zeros((count))
        d3=zeros((count))
        d4=zeros((count))
        d5=zeros((count))
        d6=zeros((count))
        d7=zeros((count))
        d8=zeros((count))
        
        fd1 = zeros((count))
        fd2 = zeros((count))
        fd1max = zeros((count))
        fd2max = zeros((count))
        
        tempindex = 1
        for tempindex in range(0,count):
            a[tempindex] = (barrier[tempindex]/stockPrice[tempindex]) ** (-1 + 2*(intRate[tempindex] - divs[tempindex])/(vol[tempindex] * vol[tempindex]))
            b[tempindex] = (barrier[tempindex]/stockPrice[tempindex]) ** (1 + 2*(intRate[tempindex] - divs[tempindex])/(vol[tempindex] * vol[tempindex]))
            d1[tempindex] = (log(stockPrice[tempindex]/strike[tempindex]) + (intRate[tempindex] - divs[tempindex] + vol[tempindex] * vol[tempindex] * 0.5)*(mat[tempindex]))/(vol[tempindex] * (mat[tempindex]**0.5))
            d2[tempindex] = (log(stockPrice[tempindex]/strike[tempindex]) + (intRate[tempindex] - divs[tempindex] - vol[tempindex] * vol[tempindex] * 0.5)*(mat[tempindex]))/(vol[tempindex] * (mat[tempindex]**0.5))
            d3[tempindex] = (log(stockPrice[tempindex]/barrier[tempindex]) + (intRate[tempindex] - divs[tempindex] + vol[tempindex] * vol[tempindex] * 0.5)*(mat[tempindex]))/(vol[tempindex] * (mat[tempindex]**0.5))
            d4[tempindex] = (log(stockPrice[tempindex]/barrier[tempindex]) + (intRate[tempindex] - divs[tempindex] - vol[tempindex] * vol[tempindex] * 0.5)*(mat[tempindex]))/(vol[tempindex] * (mat[tempindex]**0.5))
            d5[tempindex] = (log(stockPrice[tempindex]/barrier[tempindex]) - (intRate[tempindex] - divs[tempindex] - vol[tempindex] * vol[tempindex] * 0.5)*(mat[tempindex]))/(vol[tempindex] * (mat[tempindex]**0.5))
            d6[tempindex] = (log(stockPrice[tempindex]/barrier[tempindex]) - (intRate[tempindex] - divs[tempindex] + vol[tempindex] * vol[tempindex] * 0.5)*(mat[tempindex]))/(vol[tempindex] * (mat[tempindex]**0.5))
            d7[tempindex] = (log((stockPrice[tempindex]*strike[tempindex])/(barrier[tempindex] * barrier[tempindex])) - (intRate[tempindex] - divs[tempindex] - vol[tempindex] * vol[tempindex] * 0.5)*(mat[tempindex]))/(vol[tempindex] * (mat[tempindex]**0.5))
            d8[tempindex] = (log((stockPrice[tempindex]*strike[tempindex])/(barrier[tempindex] * barrier[tempindex])) - (intRate[tempindex] - divs[tempindex] + vol[tempindex] * vol[tempindex] * 0.5)*(mat[tempindex]))/(vol[tempindex] * (mat[tempindex]**0.5))
        
        
        upoutcall = zeros((count))
        upincall = zeros((count))
        downoutcall = zeros((count))
        downincall = zeros((count))
        downoutput = zeros((count))
        downinput = zeros((count))
        upoutput = zeros((count))
        upinput = zeros((count))
        
        floatingslookbackcall = zeros((count))
        floatingslookbackput = zeros((count))
        fixedslookbackcall = zeros((count))
        fixedslookbackput = zeros((count))
        for tempindex in range(0,count):
            upoutcall[tempindex] = stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*(ncdf(d1[tempindex]) - ncdf(d3[tempindex]) - b[tempindex] * (ncdf(d6[tempindex]) - ncdf(d8[tempindex]))) - strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex])*(ncdf(d2[tempindex]) - ncdf(d4[tempindex]) - a[tempindex] * (ncdf(d5[tempindex]) - ncdf(d7[tempindex])))
            upincall[tempindex] = stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*(ncdf(d3[tempindex]) + b[tempindex] * (ncdf(d6[tempindex]) - ncdf(d8[tempindex]))) - strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex])*(ncdf(d4[tempindex]) + a[tempindex] * (ncdf(d5[tempindex]) - ncdf(d7[tempindex])))
            if(strike > barrier):
                downoutcall[tempindex] = stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex]) * (ncdf(d1[tempindex]) - b[tempindex] * (1 - ncdf(d8[tempindex]))) - strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) * (ncdf(d2[tempindex]) - a[tempindex] * (1 - ncdf(d7[tempindex])))
            else:
                downoutcall[tempindex] = stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex]) * (ncdf(d3[tempindex]) - b[tempindex] * (1 - ncdf(d6[tempindex]))) - strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) * (ncdf(d4[tempindex]) - a[tempindex] * (1 - ncdf(d5[tempindex])))
                
            if(strike[tempindex] > barrier[tempindex]):
                downincall[tempindex] = stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*b[tempindex]*(1 - ncdf(d8[tempindex])) - strike[tempindex] * exp(-intRate[tempindex] * mat[tempindex])*a[tempindex]*(1 - ncdf(d7[tempindex]))
            else:
                downincall[tempindex] = stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*(ncdf(d1[tempindex]) - ncdf(d3[tempindex]) + b[tempindex] * (1 - ncdf(d6[tempindex]))) - strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) *(ncdf(d2[tempindex]) - ncdf(d4[tempindex]) + a[tempindex] * (1 - ncdf(d5[tempindex])))
            downoutput[tempindex] = -1 * stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex]) * (ncdf(d3[tempindex]) - ncdf(d1[tempindex]) - b[tempindex]*(ncdf(d8[tempindex]) - ncdf(d6[tempindex]))) + strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) * (ncdf(d4[tempindex]) - ncdf(d2[tempindex]) - a[tempindex] * (ncdf(d7[tempindex]) - ncdf(d5[tempindex])))
            downinput[tempindex] = -1 * stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*(1-ncdf(d3[tempindex])+b[tempindex]*(ncdf(d8[tempindex])-ncdf(d6[tempindex]))) + strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) * (1-ncdf(d4[tempindex]) + a[tempindex]*(ncdf(d7[tempindex]) - ncdf(d5[tempindex])))
            
            if(strike[tempindex] > barrier[tempindex]):
                upoutput[tempindex] = -1 * stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex]) * (1 - ncdf(d3[tempindex]) - b[tempindex]*ncdf(d6[tempindex])) + strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) * (1 - ncdf(d4[tempindex]) - a[tempindex] * ncdf(d5[tempindex]))
            else:
                upoutput[tempindex] = -1 * stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex]) * (1 - ncdf(d1[tempindex]) - b[tempindex]*ncdf(d8[tempindex])) + strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) * (1 - ncdf(d2[tempindex]) - a[tempindex] * ncdf(d7[tempindex])) 
            if(strike[tempindex] > barrier[tempindex]):
                upinput[tempindex] = -1 * stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*(ncdf(d3[tempindex]) - ncdf(d1[tempindex]) + b[tempindex] * ncdf(d6[tempindex])) + strike[tempindex] * exp(-1*intRate[tempindex] *mat[tempindex])*(ncdf(d4[tempindex])-ncdf(d2[tempindex]) + a[tempindex] * ncdf(d5[tempindex]))
            else:
                upinput[tempindex] = -1 * stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*b[tempindex] * ncdf(d8[tempindex]) + strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex])*a[tempindex]*ncdf(d7[tempindex])
            
            fd1[tempindex] = (log(stockPrice[tempindex] / mmin[tempindex]) + (intRate[tempindex] - divs[tempindex] + vol[tempindex]*vol[tempindex]*0.5)*(mat[tempindex]))/(vol[tempindex]*(mat[tempindex]**0.5))
            fd2[tempindex] = fd1[tempindex] - vol[tempindex] * (mat[tempindex]**0.5)
            fd1max[tempindex] = (log(stockPrice[tempindex] / mmax[tempindex]) + (intRate[tempindex] - divs[tempindex] + vol[tempindex]*vol[tempindex]*0.5)*(mat[tempindex]))/(vol[tempindex]*(mat[tempindex]**0.5))
            fd2max[tempindex] = fd1max[tempindex] - vol[tempindex] * (mat[tempindex]**0.5)
            
            floatingslookbackcall[tempindex] = stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*ncdf(fd1[tempindex]) - mmin[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex])*ncdf(fd2[tempindex]) + stockPrice[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) * vol[tempindex]*vol[tempindex]/(2*(intRate[tempindex]-divs[tempindex]))*(((stockPrice[tempindex]/mmin[tempindex]) ** (-2*(intRate[tempindex]-divs[tempindex])/(vol[tempindex]*vol[tempindex]))) * ncdf(-1*fd1[tempindex] + 2*(intRate[tempindex]-divs[tempindex])*(mat[tempindex]**0.5)/vol[tempindex]) - exp((intRate[tempindex]-divs[tempindex])*mat[tempindex])*ncdf(-fd1[tempindex]))
            floatingslookbackput[tempindex] = mmax[tempindex] * exp(-intRate[tempindex]*mat[tempindex])*ncdf(-fd2max[tempindex])-stockPrice[tempindex] * exp(-divs[tempindex]*mat[tempindex]) * ncdf(-fd1max[tempindex]) + stockPrice[tempindex] * exp(-intRate[tempindex]*mat[tempindex])*vol[tempindex]*vol[tempindex]/(2*(intRate[tempindex] - divs[tempindex]))*(-1*((stockPrice[tempindex]/mmax[tempindex]) ** (-2*(intRate[tempindex]-divs[tempindex])/(vol[tempindex]*vol[tempindex]))) * ncdf(fd1max[tempindex] - 2 * (intRate[tempindex] - divs[tempindex])*(mat[tempindex]**0.5)/vol[tempindex]) + exp((intRate[tempindex]-divs[tempindex])*mat[tempindex]) * ncdf(fd1max[tempindex]))
            fd1[tempindex] = (log(stockPrice[tempindex] / strike[tempindex]) + (intRate[tempindex] - divs[tempindex] + vol[tempindex]*vol[tempindex]*0.5)*(mat[tempindex]))/(vol[tempindex]*(mat[tempindex]**0.5))
            fd2[tempindex] = fd1[tempindex] - vol[tempindex] * (mat[tempindex]**0.5)
            if(strike[tempindex] < mmax[tempindex]):
                fixedslookbackcall[tempindex] = stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*ncdf(fd1[tempindex]) - strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex])*ncdf(fd2[tempindex]) + stockPrice[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) * vol[tempindex]*vol[tempindex]/(2*(intRate[tempindex]-divs[tempindex]))*(-1*((stockPrice[tempindex]/strike[tempindex]) ** (-2*(intRate[tempindex]-divs[tempindex])/(vol[tempindex]*vol[tempindex]))) * ncdf(fd1[tempindex] - 2*(intRate[tempindex]-divs[tempindex])*(mat[tempindex]**0.5)/vol[tempindex]) + exp((intRate[tempindex]-divs[tempindex])*mat[tempindex])*ncdf(fd1[tempindex]))
            else:
                fd1[tempindex] = (log(stockPrice[tempindex] / mmax[tempindex]) + (intRate[tempindex] - divs[tempindex] + vol[tempindex]*vol[tempindex]*0.5)*(mat[tempindex]))/(vol[tempindex]*(mat[tempindex]**0.5))
                fd2[tempindex] = fd1[tempindex] - vol[tempindex] * (mat[tempindex]**0.5)
                fixedslookbackcall[tempindex] = (mmax[tempindex] - strike[tempindex])*exp(-intRate[tempindex] * mat[tempindex]) + stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*ncdf(fd1[tempindex]) - mmax[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex])*ncdf(fd2[tempindex]) + stockPrice[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) * vol[tempindex]*vol[tempindex]/(2*(intRate[tempindex]-divs[tempindex]))*(-1*((stockPrice[tempindex]/strike[tempindex]) ** (-2*(intRate[tempindex]-divs[tempindex])/(vol[tempindex]*vol[tempindex]))) * ncdf(fd1[tempindex] - 2*(intRate[tempindex]-divs[tempindex])*(mat[tempindex]**0.5)/vol[tempindex]) + exp((intRate[tempindex]-divs[tempindex])*mat[tempindex])*ncdf(fd1[tempindex]))
                
            fd1[tempindex] = (log(stockPrice[tempindex] / strike[tempindex]) + (intRate[tempindex] - divs[tempindex] + vol[tempindex]*vol[tempindex]*0.5)*(mat[tempindex]))/(vol[tempindex]*(mat[tempindex]**0.5))
            fd2[tempindex] = fd1[tempindex] - vol[tempindex] * (mat[tempindex]**0.5)
            if(strike[tempindex] < mmin[tempindex]):
                fixedslookbackput[tempindex] = strike[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex])*ncdf(-fd2[tempindex]) - stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*ncdf(-fd1[tempindex]) + stockPrice[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) * vol[tempindex]*vol[tempindex]/(2*(intRate[tempindex]-divs[tempindex]))*(-1*((stockPrice[tempindex]/strike[tempindex]) ** (-2*(intRate[tempindex]-divs[tempindex])/(vol[tempindex]*vol[tempindex]))) * ncdf(-fd1[tempindex] + 2*(intRate[tempindex]-divs[tempindex])*(mat[tempindex]**0.5)/vol[tempindex]) - exp((intRate[tempindex]-divs[tempindex])*mat[tempindex])*ncdf(-fd1[tempindex]))
            else:
                fd1[tempindex] = (log(stockPrice[tempindex] / mmin[tempindex]) + (intRate[tempindex] - divs[tempindex] + vol[tempindex]*vol[tempindex]*0.5)*(mat[tempindex]))/(vol[tempindex]*(mat[tempindex]**0.5))
                fd2[tempindex] = fd1[tempindex] - vol[tempindex] * (mat[tempindex]**0.5)
                fixedslookbackput[tempindex] = (strike[tempindex] - mmin[tempindex])*exp(-intRate[tempindex] * mat[tempindex]) - stockPrice[tempindex] * exp(-1*divs[tempindex]*mat[tempindex])*ncdf(-fd1[tempindex]) + mmin[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex])*ncdf(-fd2[tempindex]) + stockPrice[tempindex] * exp(-1*intRate[tempindex]*mat[tempindex]) * vol[tempindex]*vol[tempindex]/(2*(intRate[tempindex]-divs[tempindex]))*(((stockPrice[tempindex]/mmin[tempindex]) ** (-2*(intRate[tempindex]-divs[tempindex])/(vol[tempindex]*vol[tempindex]))) * ncdf(-fd1[tempindex] + 2*(intRate[tempindex]-divs[tempindex])*(mat[tempindex]**0.5)/vol[tempindex]) - exp((intRate[tempindex]-divs[tempindex])*mat[tempindex])*ncdf(-fd1[tempindex]))
        
        self.response.headers['Content-Type']='application/json'
        self.response.out.write("[")
        self.response.out.write("{ doc: 'Down And Out Call', dic: 'Down And In Call', dop: 'Down And Out Put', dip: 'Down And In Put', uop: 'Up And Out Put', uip: 'Up And In Put', uoc: 'Up And Out Call', uic: 'Up And In Call' },")

        for tempindex in range(0,count):
            self.response.out.write("{ doc: '"+str(downoutcall[tempindex])+"', dic: '"+str(downincall[tempindex])+"', dop: '"+str(downoutput[tempindex])+"', dip: '"+str(downinput[tempindex])+"', uop: '"+str(upoutput[tempindex])+"', uip: '"+str(upinput[tempindex])+"', uoc: '"+str(upoutcall[tempindex])+"', uic: '"+str(upincall[tempindex])+"'} ,")
            
        self.response.out.write("{ doc: 'Floating Strike Lookback Call', dic: 'Floating Strike Lookback Put', dop: 'Fixed Strike Lookback Call', dip: 'Fixed Strike Lookback Put', uop: '---', uip: '---', uoc: '---', uic: '---' },")

        for tempindex in range(0,count):
            self.response.out.write("{ doc: '"+str(floatingslookbackcall[tempindex])+"', dic: '"+str(floatingslookbackput[tempindex])+"', dop: '"+str(fixedslookbackcall[tempindex])+"', dip: '"+str(fixedslookbackput[tempindex])+"', uop: '---', uip: '---', uoc: '---', uic: '---' },")


        self.response.out.write("{ doc: '---', dic: '---', dop: '---', dip: '---', uop: '---', uip: '---', uoc: '---', uic: '---' }]")
       
app = webapp2.WSGIApplication([('/analytics/basicpricer',basicpricer)],debug=True)


