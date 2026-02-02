“智能体”页面，在构建workflow智能体画布的“规划”页面，增加一个组件“Excel”解析，将用户提供的excel，解析为一个list。

以下是一个典型的 Excel 解析任务描述，适用于数据处理、ETL（抽取-转换-加载）或后端服务场景：

任务名称：Excel 文件解析为对象列表

任务目标  
将一个 .xlsx 或 .xls 格式的 Excel 文件解析为一个 Python 列表，其中每个元素是一个字典（或对象），字典的键（key）对应 Excel 表格中的列名（即第一行的表头），值（value）对应该行在对应列下的单元格内容。

输入  
- 一个 Excel 文件路径（例如：data.xlsx）  
- （可选）指定要读取的工作表名称或索引（默认为第一个工作表）

输出  
- 一个列表 records，结构如下：
    [
      {
          "姓名": "张三",
          "年龄": 28,
          "城市": "北京"
      },
      {
          "姓名": "李四",
          "年龄": 34,
          "城市": "上海"
      },
      # ... 其他行
  ]
  
  其中：
  - 每个字典代表 Excel 中的一行数据（从第二行开始）
  - 字典的键来自 Excel 第一行的列标题
  - 值保留原始数据类型（如数字保持为 int/float，文本为 str，空单元格可表示为 None 或空字符串）

示例 Excel 内容（data.xlsx）  
姓名   年龄   城市
张三   28     北京

李四   34     上海

技术实现要点（以 Python 为例）  
- 使用 pandas 库读取 Excel：
    import pandas as pd

  def parse_excel_to_list(file_path, sheet_name=0):
      df = pd.read_excel(file_path, sheet_name=sheet_name)
      # 将 DataFrame 转换为字典列表
      records = df.to_dict(orient='records')
      return records
  
- 或使用 openpyxl 手动解析（适用于不依赖 pandas 的场景）：
    from openpyxl import load_workbook

  def parse_excel_to_list(file_path, sheet_name=None):
      wb = load_workbook(file_path, data_only=True)
      ws = wb[sheet_name] if sheet_name else wb.active

      headers = [cell.value for cell in ws[1]]  # 第一行作为列名
      records = []
      for row in ws.iter_rows(min_row=2, values_only=True):
          record = {headers[i]: row[i] for i in range(len(headers))}
          records.append(record)
      return records
  

注意事项  
- 处理空列名或重复列名（建议清洗或抛出警告）
- 支持多种数据类型（日期、布尔值、数字、文本）
- 忽略完全空白的行（可选）
- 确保内存效率（对于大文件可考虑分块读取）

该任务广泛应用于数据导入、报表解析、自动化测试数据准备等场景。

以上需求已经实现，新需求如下：
目前“Excel解析”节点的输入参数“fileUrl”需要能从“开始”节点的fileUrls里面引用其中的一个，比如引用"{{start_node.fileUrls.0}}" ,实现上需要能在“Excel解析”组件的编辑面板进行选择。然后能够在调试和运行的时候，将文件url往后传递。

