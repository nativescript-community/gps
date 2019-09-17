#import <Foundation/Foundation.h>

@interface NSDate (BootTime)

+ (NSDate *)bootTime;

+ (NSTimeInterval)bootTimeTimeIntervalSinceReferenceDate;

@end