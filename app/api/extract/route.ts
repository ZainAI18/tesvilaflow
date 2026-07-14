import { NextRequest, NextResponse } from "next/server";
export async function POST(req:NextRequest){
 const form=await req.formData(); const file=form.get("file") as File|null; const type=String(form.get("documentType")||"");
 if(!file||!["invoice","delivery_order"].includes(type))return NextResponse.json({error:"A valid file and documentType are required"},{status:400});
 if(!["application/pdf","image/png","image/jpeg"].includes(file.type))return NextResponse.json({error:"Only PDF, PNG and JPEG are accepted"},{status:415});
 const endpoint=process.env.DOCUMENT_AI_ENDPOINT,key=process.env.DOCUMENT_AI_API_KEY;
 if(!endpoint||!key)return NextResponse.json({error:"Document extraction is not configured. Add DOCUMENT_AI_ENDPOINT and DOCUMENT_AI_API_KEY."},{status:503});
 const upstream=new FormData();upstream.append("file",file);upstream.append("schema",JSON.stringify(type==="invoice"?{invoice_number:"string",invoice_date:"date",customer:"string",po_number:"string",do_number:"string",items:[{product_model:"string",description:"string",quantity:"number",unit_price:"number",line_amount:"number"}],subtotal:"number",gst:"number",grand_total:"number"}:{do_number:"string",delivery_date:"date",customer:"string",items:[{product_model:"string",product_description:"string",quantity:"number",remarks:"string"}]}));
 const res=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${key}`},body:upstream});if(!res.ok)return NextResponse.json({error:"Extraction provider rejected the document"},{status:502});return NextResponse.json(await res.json());
}
