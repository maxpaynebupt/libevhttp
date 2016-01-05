/* 
 * File:   FileServerHttpServlet.h
 * Author: try
 *
 * Created on 2012年3月31日
 */

#ifndef FileServerHttpServlet_H
#define	FileServerHttpServlet_H

#include <fcntl.h>
#include <sys/stat.h>
#include <sys/file.h>
#include <string.h>
#include <errno.h>
#include <evhttp/log.h>
#include <evhttp/HttpServlet.h>


#define SEND_SIZE 1024*512


/**
 * 测试通过Response.sendfile发送文件
 * 
 * http://192.168.99.60:3080/file/root/flvs/1.flv?speed=1048576&offset=0&length=0
 */
class FileServerHttpServlet : public HttpServlet{
public:
    FileServerHttpServlet():flvfd(-1){
        LOG_INFO("");
    }
    virtual ~FileServerHttpServlet(){
        //LOG_INFO("");
        close();
    }
    
    virtual void service(Request& req, Response& resp){
        //LOG_INFO("start...");
        //下载速度, 每秒下载速度
        const char* speed = req.getParameter("speed");
        int speedval = 0;
        if(speed){
            speedval  = atoi(speed);
        }else{
            speedval = SEND_SIZE; //默认速度为SEND_SIZE字节
        }    
        
        //下载位置
        const char* offset = req.getParameter("offset");
        off_t offsetval = 0;
        if(offset){
            offsetval  = atol(offset);
        }else{
            offsetval = 0;
        }  
        
        //下载数据量
        const char* length = req.getParameter("length");
        off_t lengthval = 0;
        if(length){
            lengthval  = atol(length);
        }else{
            lengthval = 0;
        }          
        
        //取文件路径，去掉URL根位置部分
        const char* flvfile = req.path+5; //去掉/flv部份前缀
        if(!flvfile){
            LOG_WARN("file name error, flvfile:%s", flvfile);
            resp.setStatus(400, "error");
            return;
        }
        
        //取文件信息
        struct stat filestat;
        if(stat(flvfile, &filestat)!=0){
            LOG_WARN("file not exist! errno:%d", errno);
            resp.setStatus(400, "file not exist");
            return;
        }
        if(S_ISDIR(filestat.st_mode)){
            LOG_WARN("is dir");
            resp.setStatus(400, "error, is dir");
            return;
        }
        
        //打开文件
        flvfd = ::open(flvfile, O_RDONLY | O_NONBLOCK);
        if(flvfd < 0){
            LOG_WARN("open file error, errno:%d", errno);
            resp.setStatus(400, "open file error");
            return;
        }
        
        if(isSuffix(flvfile, ".flv")){
            resp.setContentType("video/x-flv");
        }else if(isSuffix(flvfile, ".html") || isSuffix(flvfile, ".htm")){
            resp.setContentType("text/html; charset=utf-8");
        }else if(isSuffix(flvfile, ".txt") || isSuffix(flvfile, ".js")){
            resp.setContentType("text/plain; charset=utf-8");
        }else{
            resp.setContentType("application/x-msdownload");
        }
        //计算并设置下载的内容数据量
        size_t efflen = filestat.st_size - offsetval;
        if(lengthval <= 0){
            lengthval = efflen;
        }else{
            if(lengthval > efflen){
                lengthval = efflen;
            }
        }
        resp.setContentLength(lengthval); //如果想以Chunked方式传输文件，可以不设置内容长度
        
        resp.sendfile(flvfd, offsetval, lengthval, speedval, SEND_SIZE);
        
    }
    

    
private:
   
    bool isSuffix(const char* src, const char* suffix){
        int srclen = strlen(src);
        int suffixlen = strlen(suffix);
        if(srclen < suffixlen){
            return false;
        }
        return strcasecmp(src+(srclen-suffixlen), suffix)==0;
    }
    
    void close(){
        if(flvfd > 0){
          ::close(flvfd);
          flvfd = -1;
        }
    }    
    
private:
    int flvfd;
};

#endif	/* FileServerHttpServlet_H */

