#include <netinet/tcp.h>
#include <arpa/inet.h>
#include <stdio.h>
#include <fcntl.h>
#include <iostream>
#include <string>

#include <evhttp/HttpServer.h>
#include <evhttp/Conf.h>
#include <evhttp/HttpServletFactory.h>

#include "HelloHttpServlet.h"
#include "ReadFormBodyHttpServlet.h"
#include "SendfileIOPumpHttpServlet.h"
#include "RWIOPumpHttpServlet.h"
#include "FileServerHttpServlet.h"
#include "cfgparser.h"
#include "configwrapper.h"


#define SERVER_PORT 3080
#define LOG_LEVEL LOG_DEBUG_LEVEL

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
    if (cfg.readFile("evhttpd.cfg"))
    {
        printf("Error: Cannot open config file 'evhttpd.cfg'\n");
        return 1;
    }

    ConfigWrapper_t cfgWrapper(cfg);
    int workProcessCount=1;
    string log4cpluscfg="";
    cfgWrapper.getInt("default","workProcessCount",workProcessCount);
    cfgWrapper.getString("default","log4cpluscfg",log4cpluscfg);

    Conf conf;
    conf.workProcessCount = workProcessCount;
    conf.log4cpluscfg = log4cpluscfg;
    conf.initLog();

    LOG_INFO("Server started...");
 
    //配置HttpServer
    TestHttpServletFactory servletFactory;
    HttpServer httpServer(SERVER_PORT, &servletFactory, &conf);
    
    //启动HttpServer
    if(!httpServer.start()){
        return 1;
    }
    HttpServer::loop();
}


