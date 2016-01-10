#include <netinet/tcp.h>
#include <arpa/inet.h>
#include <stdio.h>
#include <fcntl.h>
#include <iostream>
#include <string>

#include <evhttp/HttpServer.h>
#include <evhttp/Conf.h>
#include <evhttp/HttpServletFactory.h>
#include <cfgparser.h>
#include <configwrapper.h>

#include "HelloHttpServlet.h"
#include "ReadFormBodyHttpServlet.h"
#include "SendfileIOPumpHttpServlet.h"
#include "RWIOPumpHttpServlet.h"
#include "FileServerHttpServlet.h"



class TestHttpServletFactory : public HttpServletFactory{
public:
    TestHttpServletFactory(){
    
    }
    virtual ~TestHttpServletFactory(){}

    virtual HttpServlet* create(const char* path){
        if(strcmp(path, "/hello") == 0){
            return new HelloHttpServlet();
            
        }else if(strcmp(path, "/form") == 0){
            return new ReadFormBodyHttpServlet();
            
        }else if(strncmp(path, "/sf/", 4) == 0){
            return new SendfileIOPumpHttpServlet();
            
        }else if(strncmp(path, "/rw/", 4) == 0){
            return new RWIOPumpHttpServlet();
            
        }else if(strncmp(path, "/file/", 6) == 0){
            return new FileServerHttpServlet();
            
        }
        
        return new HelloHttpServlet();
    }
    
    void free(HttpServlet* servlet){
        delete servlet;
    }
    
};


int main(int argc, char** argv) {
    ConfigParser_t cfg;
    if (cfg.readFile("evhttpd.conf"))
    {
        printf("Error: Cannot open config file 'evhttpd.conf'\n");
        return 1;
    }

    ConfigWrapper_t cfgWrapper(cfg);
    Conf conf;

    cfgWrapper.getInt("default","workProcessCount",conf.workProcessCount);
    cfgWrapper.getString("default","log4cpluscfg",conf.log4cpluscfg);
    cfgWrapper.getInt("default","listenport",conf.listenport);

    conf.initLog();
 
    //配置HttpServer
    TestHttpServletFactory servletFactory;
    HttpServer httpServer(conf.listenport, &servletFactory, &conf);
    
    //启动HttpServer
    if(!httpServer.start()){
        return 1;
    }
    HttpServer::loop();
}


