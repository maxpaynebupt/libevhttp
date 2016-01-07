#ifndef _LOGGER_H
#define _LOGGER_H

#include <log4cplus/logger.h>
#include <log4cplus/loggingmacros.h>
#include <log4cplus/configurator.h>


//使用日志配置初始化log日志
#define INIT_LOG(filePath) log4cplus::PropertyConfigurator::doConfigure(filePath)

//设置日志级别
//#define SET_LOG_LEVEL(level) log4cplus::Logger::getRoot().setLogLevel(level)

//定义日志输出
#define LOG_TRACE(logs...) LOG4CPLUS_TRACE_FMT(log4cplus::Logger::getRoot(), logs)
#define LOG_DEBUG(logs...) LOG4CPLUS_DEBUG_FMT(log4cplus::Logger::getRoot(), logs)
#define LOG_INFO(logs...)  LOG4CPLUS_INFO_FMT (log4cplus::Logger::getRoot(), logs)
#define LOG_ERROR(logs...) LOG4CPLUS_ERROR_FMT(log4cplus::Logger::getRoot(), logs)
#define LOG_WARN(logs...)  LOG4CPLUS_WARN_FMT (log4cplus::Logger::getRoot(), logs)
#define LOG_FATAL(logs...) LOG4CPLUS_FATAL_FMT(log4cplus::Logger::getRoot(), logs)
#endif
