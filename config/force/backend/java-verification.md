# Java 验证规范

通用要求遵循 [测试规范](../testing-standards.md)；本文补充 Java 编译与运行机制的专项差异。

| 改动或操作涉及 | 验证重点 |
| --- | --- |
| Java 源码、模块依赖或注解处理器 | 源码有语义变化，或依赖、注解处理变化影响编译时，执行受影响模块编译，可由包含该步骤的定向测试完成；测试源码、生成代码及公共类型消费者按影响纳入 |
| Maven Failsafe 集成测试 | 完成 [verify 阶段的结果判定](https://maven.apache.org/surefire/maven-failsafe-plugin/)，覆盖项目配置的测试执行与环境清理阶段 |
| 配置文件、Bean、组件扫描或条件装配 | 验证受影响配置下的上下文加载与绑定；配置绑定规则变化时覆盖缺失、非法值，启动链路变化时核对就绪信号 |
| SQL、Mapper XML 或实体映射 | 执行受影响 SQL 分支，核对参数绑定、字段与结果映射及数据库约束 |
| Spring 代理、事务或异步注解 | 经容器 Bean 的实际调用路径验证代理、事务提交与回滚及异步执行，覆盖受影响的内部调用和异常边界 |
| Controller、DTO、序列化、校验或过滤器 | 通过请求处理链验证参数绑定、序列化、校验分组、过滤器顺序及异常转换后的响应 |
| JDK、依赖、打包或类加载 | 核对编译目标与运行 JDK、运行时依赖；类路径配置、资源入包、SPI 发现配置或产物启动装配受影响时，从实际产物验证 |

注意验证方式的证明范围：默认事务代理模式下，同类内部调用不会触发事务拦截；直接实例化对象或仅用 Mock 不能证明代理生效。[事务代理说明](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)

`@SpringBootTest` 默认加载 Spring 容器，不启动监听 HTTP 端口的 Web 服务器。

- HTTP 启动监听受影响时，核对实际启动结果与目标服务的监听状态，包括预期启动失败。
- 需证明 HTTP 可访问性、模拟请求无法覆盖的 Web 容器或网络行为，或验证真实 HTTP 业务入口时，向符合验证目标的已运行服务或测试服务发送真实 HTTP 请求。
- [RANDOM_PORT](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/test/context/SpringBootTest.WebEnvironment.html) 设置 `server.port=0`，仅在随机端口不改变验证目标时使用；验证端口配置本身须保留被测配置。

真实 HTTP 调用的服务端写入不随测试事务自动回滚。[Spring Boot 测试说明](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)
