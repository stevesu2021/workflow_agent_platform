“智能体”页面，在构建workflow智能体画布的“规划”页面，设置“For循环”节点。
强调可视化设计方面的要求，确保用户可以直观地看到循环体内的所有操作，并明确输入输出的数据流。

For 循环节点（For Loop）

一、核心目标

- 遍历数组：对输入的数组进行迭代处理。
- 聚合结果：将每次迭代的结果收集起来形成新的数组输出。
- 可视化呈现：使用一个大的虚线矩形框来标识循环区域，使循环内部的所有组件清晰可见并包含在内。

二、功能需求

1. 输入
   - array_input: 需要遍历的数组（如 {{vars.user_list}}）
   - item_alias: 当前项别名，默认为 "item"
   - max_iterations: 最大迭代次数，防止无限循环（可选）

2. 输出
   - results_array: 每次迭代子流程执行后的结果组成的数组
   - iteration_count: 实际完成的迭代次数

3. 内部逻辑
   - 对 array_input 中的每一项执行指定的操作（即循环体内配置的一系列组件），并收集每个操作的结果。
   - 支持设置最大迭代次数以避免意外的无限循环或过长的处理时间。

三、UI 设计需求

1. 节点外观
   - 使用一个大的虚线矩形框来表示整个循环结构。
   - 矩形框内部允许拖拽其他组件进入，这些组件代表一次迭代中需要执行的操作。
   - 在矩形框顶部显示当前循环的相关信息（如 for item in {{vars.user_list}}）。

2. 配置面板
      - 输入数组: [变量选择器，仅显示 array 类型]
   - 当前项别名: input (默认: "item")
   - 最大迭代次数: number input (默认: 50, min:1)
   
   - 提供选项让用户选择如何处理失败的迭代（如跳过/终止）。

3. 连接规则
   - 循环外部的组件只能与循环节点的入口和出口直接相连。
   - 循环内部的组件之间的连接遵循一般规则，但它们必须完全位于循环边界内。

4. 调试支持
   - 在日志中记录每次迭代开始时的索引值和当前处理的元素。
   - 提供选项查看单个迭代的详细执行情况，便于调试。

四、执行引擎逻辑, 仅供参考 

def execute_for_loop_node(node, context):
    items = evaluate_expression(node.config.array_input, context)  # 解析出列表
    if not isinstance(items, list):
        raise ValueError("For loop input must be a list")

    results = []
    alias = node.config.item_alias or "item"
    max_iter = min(len(items), node.config.max_iterations)

    for i in range(max_iter):
        # 创建子上下文，注入当前项
        child_context = context.copy()
        child_context[alias] = items[i]

        try:
            # 执行子图（从 loop 内部 start 到 end）
            sub_output = execute_subgraph(node.subgraph, child_context)
            results.append(sub_output)
        except Exception as e:
            # 根据配置决定是否跳过错误或终止循环
            if node.config.on_error == 'skip':
                continue
            else:
                raise e

    # 更新主上下文
    context[node.id + ".results"] = results
    context[node.id + ".iteration_count"] = len(results)

五、注意事项

- 性能考虑：对于非常大的数组，应考虑优化方案，比如分批处理或者限制并发度。
- 用户体验：确保界面清晰，易于理解循环的作用范围及其对数据的影响。
- 安全性：严格控制循环的最大迭代次数，避免因误配置导致系统资源耗尽。

通过以上改进和完善，我们不仅明确了 For 循环节点的功能需求，还特别注重了其在可视化编辑器中的表现形式，使得即使是复杂的工作流也能被轻松构建和管理。
