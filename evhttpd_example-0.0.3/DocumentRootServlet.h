/* 
 * File:   DocumentRootServlet.h
 * Author: try
 *
 * Created on 2012年3月31日
 */

#ifndef DocumentRootServlet_H
#define	DocumentRootServlet_H

#include <fcntl.h>
#include <sys/stat.h>
#include <sys/file.h>
#include <string.h>
#include <errno.h>
#include <evhttp/HttpServlet.h>

#define SEND_SIZE 1024*512


/**
 * 
 * http://192.168.99.60:3080/file/root/flvs/1.flv?speed=1048576&offset=0&length=0
 */
typedef std::map<string,int> FdMap;
class DocumentRootServlet : public HttpServlet{
private:
    int filefd;
    static FdMap fdmap;
public:
    DocumentRootServlet():filefd(-1){
        LOG_INFO("");
    }
    virtual ~DocumentRootServlet(){
        //LOG_INFO("");
        close();
    }
    
    virtual void service(Request& req, Response& resp){
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
        LOG_INFO("req.path=%s",req.path);
        char *file;
        if(strcmp(req.path,"/")==0){
            file=(char*)malloc(strlen("www")+strlen(req.path)+strlen("index.html"));
            memset(file,'\0',4);
            strcat(file,"www");
            strcat(file,req.path);
            strcat(file,"index.html");
        }else{
            file=(char*)malloc(strlen("www")+strlen(req.path));
            memset(file,'\0',4);
            strcat(file,"www");
            strcat(file,req.path);
        }

        LOG_INFO("file=%s",file);
        
   
        if(!file){
            LOG_WARN("file name error, file:%s", file);
            resp.setStatus(400, "error");
            free(file);
            return;
        }
        
        //取文件信息
        struct stat filestat;
        if(stat(file, &filestat)!=0){
            LOG_WARN("file %s not exist! errno:%d",file, errno);
            resp.setStatus(400, "file not exist");
            free(file);
            return;
        }
        if(S_ISDIR(filestat.st_mode)){
            LOG_WARN("is dir");
            resp.setStatus(400, "error, is dir");
            free(file);
            return;
        }
        
        //打开文件
        if(fdmap.find(file)!=fdmap.end()){
            filefd=fdmap[file];
        }else{
            filefd = ::open(file, O_RDONLY | O_NONBLOCK);
            if(filefd < 0){
                LOG_WARN("open file error, errno:%d", errno);
                resp.setStatus(400, "open file error");
                free(file);
                return;
            }else{
                fdmap[file]=filefd;
           // LOG_INFO("File in map %s:%d",file,fdmap[file]);
            //LOG_INFO("fdmap.size=%d",fdmap.size());
            }
        }
        
        if(isSuffix(file, ".flv")){
            resp.setContentType("video/x-flv");
        }else if(isSuffix(file, ".html") || isSuffix(file, ".htm")){
            resp.setContentType("text/html; charset=utf-8");
        }else if(isSuffix(file, ".txt") || isSuffix(file, ".js")){
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
        
        LOG_INFO("sendfile %s", file);
        resp.sendfile(filefd, offsetval, lengthval, speedval, SEND_SIZE);
        free(file);
        
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
        if(filefd > 0){
          ::close(filefd);
          filefd = -1;
        }
    }    
    
};

FdMap DocumentRootServlet::fdmap;

#endif	/* DocumentRootServlet_H */

