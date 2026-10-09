import { categories } from "@/data/mock";

export function CategoryPills() {
  return <div className="category-row">{categories.map((item, index) => <span className={`category-pill ${index===0?"active":""}`} key={item}>{item}</span>)}</div>;
}
